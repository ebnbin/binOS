import { execFileSync, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { closeSync, constants, existsSync, openSync, readFileSync, rmSync } from 'node:fs'
import { open } from 'node:fs/promises'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { claudeConfigDir, codexHome, repoDir } from '../../paths.js'
import { replyFilesPrompt } from './reply-files.js'
import type { Provider } from './types.js'

// 一轮回答用到的文件：给 agent 发消息的管道（FIFO）、转发进程的进程号、agent 的输出和错误信息
export type TurnFiles = { input: string; relay: string; output: string; errors: string }

// agent 的标准输入接一个转发进程（cat）：它以读写方式打开管道，把写进管道的消息原样转给 agent。
// 后端（包括重启后的新后端）随时可以往管道里写消息，agent 在下一次工具调用之间就会看到。
// 转发进程自己占着管道的写端，管道永远读不到结尾；要让 agent 答完退出，就结束转发进程（closeInput）。
// 不直接把管道接给 agent，是因为它在命名管道上察觉不到输入结束，答完也不会退出
const relayScript = 'F=$1; R=$2; shift 2; exec "$@" < <(exec sh -c \'echo $$ > "$1"; exec cat 0<>"$0"\' "$F" "$R")'

// sessionId：接着 agent 那边的这个会话，没有就开一个新的；model、effort 没有时用 agent 自己的默认
export type AgentLaunch = { provider: Provider; sessionId?: string; model?: string; effort?: string }

// 输出直接写进文件，自成一个进程组（转发进程也在里面）：后端重启时 launchd 结束的是后端所在的进程组，agent 不受影响，
// 后端重启后接着读文件、接着往管道里写。bash 执行脚本后 exec 成 agent，进程号就是 agent 的
export function spawnAgent(files: TurnFiles, launch: AgentLaunch): number | undefined {
  for (const file of [files.input, files.relay]) {
    rmSync(file, { force: true })
  }
  execFileSync('mkfifo', [files.input])
  const stdout = openSync(files.output, 'w')
  const stderr = openSync(files.errors, 'w')
  try {
    const child = spawn('/bin/bash', ['-c', relayScript, 'binos', files.input, files.relay, ...agentCommand(launch)], {
      cwd: repoDir,
      env: agentEnv(),
      stdio: ['ignore', stdout, stderr],
      detached: true,
    })
    child.on('error', () => {})
    child.unref()
    return child.pid
  } finally {
    closeSync(stdout)
    closeSync(stderr)
  }
}

function agentCommand({ provider, sessionId, model, effort }: AgentLaunch): string[] {
  if (provider === 'codex') {
    // 转接进程和这个模块在一起，开发时是 .ts
    const bridge = path.join(import.meta.dirname, `codex-bridge${path.extname(import.meta.filename)}`)
    return [process.execPath, bridge, JSON.stringify({ threadId: sessionId, model, effort, instructions: replyFilesPrompt })]
  }
  return [
    'claude',
    '-p',
    '--input-format', 'stream-json',
    '--permission-mode', 'bypassPermissions',
    '--output-format', 'stream-json',
    '--verbose',
    '--include-partial-messages',
    // 思考默认只给加密的原文，要这个才给出能显示的摘要
    '--thinking-display', 'summarized',
    // 子 agent 的文字和思考也转发出来，带着 parent_tool_use_id
    '--forward-subagent-text',
    '--chrome',
    '--append-system-prompt', replyFilesPrompt,
    ...(model ? ['--model', model] : []),
    ...(effort ? ['--effort', effort] : []),
    ...(sessionId ? ['--resume', sessionId] : ['--session-id', randomUUID()]),
  ]
}

// 后端可能是从 Claude Code 或 Codex 里启动的（比如测试实例），agent 不能继承那里的设置
function agentEnv(): NodeJS.ProcessEnv {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !/^(CLAUDE|ANTHROPIC|CODEX|OPENAI)/.test(key)),
  )
  return { ...env, CLAUDE_CONFIG_DIR: claudeConfigDir, CODEX_HOME: codexHome }
}

// 同时写的两条消息可能交错，按顺序一条条写
const writing = new Map<string, Promise<void>>()

export function sendMessage(files: TurnFiles, text: string): Promise<void> {
  return writeLine(files, { type: 'user', message: { role: 'user', content: text } })
}

// 停下正在做的事（正在运行的命令也会被中止），之后发的消息马上处理；会话和上下文都保留
export function sendInterrupt(files: TurnFiles): Promise<void> {
  return writeLine(files, { type: 'control_request', request_id: crypto.randomUUID(), request: { subtype: 'interrupt' } })
}

function writeLine(files: TurnFiles, message: object): Promise<void> {
  const line = JSON.stringify(message) + '\n'
  const previous = writing.get(files.input) ?? Promise.resolve()
  const next = previous
    .catch(() => {})
    .then(async () => {
      // 先用非阻塞方式确认转发进程已经在读，否则打开会一直卡住；刚启动时它可能还没就绪，稍等再试
      for (let attempt = 0; ; attempt++) {
        try {
          closeSync(openSync(files.input, constants.O_WRONLY | constants.O_NONBLOCK))
          break
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENXIO' || attempt >= 50) {
            throw new Error('没法给 agent 发消息', { cause: error })
          }
          await sleep(100)
        }
      }
      const handle = await open(files.input, 'a')
      try {
        await handle.write(line)
      } finally {
        await handle.close()
      }
    })
  writing.set(files.input, next)
  return next
}

// 转发进程的进程号；已经不在（或者进程号被别的程序用了）时返回 undefined
function relayPid(files: TurnFiles): number | undefined {
  try {
    const pid = Number(readFileSync(files.relay, 'utf8'))
    const args = execFileSync('ps', ['-o', 'args=', '-p', String(pid)], { encoding: 'utf8' }).trim()
    return args === 'cat' ? pid : undefined
  } catch {
    return undefined
  }
}

// 还能不能给 agent 发消息：管道和转发进程都在
export function inputOpen(files: TurnFiles): boolean {
  return existsSync(files.input) && relayPid(files) !== undefined
}

// 不再给 agent 发消息：等正在写的消息写完，再结束转发进程，agent 处理完已经发过去的消息就会退出
export async function closeInput(files: TurnFiles) {
  await writing.get(files.input)?.catch(() => {})
  stopRelay(files)
}

// 结束转发进程
export function stopRelay(files: TurnFiles) {
  const pid = relayPid(files)
  if (pid === undefined) {
    return
  }
  try {
    process.kill(pid, 'SIGTERM')
  } catch {
    // 已经结束了
  }
}

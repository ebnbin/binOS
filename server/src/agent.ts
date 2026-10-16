import { execFileSync, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import {
  closeSync,
  existsSync,
  fstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { libraryDir, repoDir } from './paths.js'
import {
  appendEntry,
  createSession,
  listSessions,
  readSessionInfo,
  readTranscript,
  sessionDir,
  writeSessionInfo,
} from './sessions.js'
import type { Entry } from './sessions.js'

// 推给页面的事件：新写入的条目、正在生成的文字、是否有回答在进行
export type LiveEvent =
  | { type: 'entry'; index: number; entry: Entry }
  | { type: 'partial'; text: string }
  | { type: 'status'; running: boolean }

// 回答进行期间的 turn/ 目录：agent 的输出直接写进文件，后端重启后能接着读
const turnDir = (id: number) => path.join(sessionDir(id), 'turn')
const outputPath = (id: number) => path.join(turnDir(id), 'claude-output.jsonl')
const errorsPath = (id: number) => path.join(turnDir(id), 'claude-errors.log')
const statePath = (id: number) => path.join(turnDir(id), 'state.json')

// 进程号可能被系统重新分配给别的程序，所以同时记下进程的启动时间，两者都对得上才是同一个进程
type TurnState = {
  pid: number
  startedAt: string
}

const listeners = new Map<number, Set<(event: LiveEvent) => void>>()

// 同一时间只有一个回答在进行
let running: { sessionId: number; text: string } | undefined

export function subscribe(sessionId: number, listener: (event: LiveEvent) => void) {
  const set = listeners.get(sessionId) ?? new Set()
  set.add(listener)
  listeners.set(sessionId, set)
  return () => {
    set.delete(listener)
  }
}

// 当前状态：页面连上时先拿到这个
export function liveState(sessionId: number): LiveEvent[] {
  if (running?.sessionId !== sessionId) {
    return [{ type: 'status', running: false }]
  }
  return [
    { type: 'status', running: true },
    { type: 'partial', text: running.text },
  ]
}

function emit(sessionId: number, event: LiveEvent) {
  for (const listener of listeners.get(sessionId) ?? []) {
    listener(event)
  }
}

function append(sessionId: number, fields: Parameters<typeof appendEntry>[1]) {
  const { entry, index } = appendEntry(sessionId, fields)
  emit(sessionId, { type: 'entry', index, entry })
}

// 开始一轮回答，返回 session 编号；已有回答在进行时返回 undefined。sessionId 为空时新建 session
export function startTurn(sessionId: number | undefined, text: string): number | undefined {
  if (running) {
    return undefined
  }
  const id = sessionId ?? createSession({ claudeSessionId: randomUUID() })
  // Claude 的会话在第一轮成功回答后才算建立；之前都失败过就换一个新的会话重新开始
  const established = readTranscript(id).some((entry) => entry.type === 'assistant')
  let { claudeSessionId } = readSessionInfo(id)
  if (!established && sessionId !== undefined) {
    claudeSessionId = randomUUID()
    writeSessionInfo(id, { claudeSessionId })
  }

  append(id, { type: 'user', message: { role: 'user', content: text } })
  mkdirSync(turnDir(id), { recursive: true })
  const stdout = openSync(outputPath(id), 'w')
  const stderr = openSync(errorsPath(id), 'w')
  // 自成一个进程组：后端重启时 launchd 结束的是后端所在的进程组，agent 不受影响
  const child = spawn(
    'claude',
    [
      '-p', text,
      '--permission-mode', 'bypassPermissions',
      '--output-format', 'stream-json',
      '--verbose',
      '--include-partial-messages',
      established ? '--resume' : '--session-id', claudeSessionId,
    ],
    { cwd: repoDir, env: agentEnv(), stdio: ['ignore', stdout, stderr], detached: true },
  )
  closeSync(stdout)
  closeSync(stderr)
  child.on('error', () => {})
  child.unref()

  const startedAt = child.pid && processStartTime(child.pid)
  if (!child.pid || !startedAt) {
    rmSync(turnDir(id), { recursive: true, force: true })
    append(id, { type: 'system', subtype: 'error', content: 'agent 启动失败' })
    return id
  }
  const state: TurnState = { pid: child.pid, startedAt }
  writeFileSync(statePath(id), JSON.stringify(state) + '\n')
  follow(id, state)
  return id
}

// 跟进一轮回答：读取输出文件的新增内容并推给页面，直到 agent 进程退出。
// 出现 result 不代表结束：agent 有后台任务时会继续等待，任务结束后接着回答
function follow(id: number, state: TurnState) {
  running = { sessionId: id, text: '' }
  emit(id, { type: 'status', running: true })

  // 已完成的文字块，以及正在生成的那一块
  const blocks: string[] = []
  let partial = ''
  let result: { is_error?: boolean; result?: string } | undefined
  let offset = 0
  let pending = Buffer.alloc(0)

  const showProgress = () => {
    running!.text = [...blocks, partial].filter(Boolean).join('\n\n')
    emit(id, { type: 'partial', text: running!.text })
  }

  const handleLine = (line: string) => {
    let data
    try {
      data = JSON.parse(line)
    } catch {
      return
    }
    // 子任务的输出不算在这一轮的回答里
    if (data.parent_tool_use_id) {
      return
    }
    if (data.type === 'stream_event') {
      const event = data.event
      if (event.type === 'content_block_start' && event.content_block.type === 'text') {
        partial = ''
      } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        partial += event.delta.text
        showProgress()
      }
    } else if (data.type === 'assistant') {
      for (const block of data.message.content) {
        if (block.type === 'text') {
          blocks.push(block.text)
          partial = ''
        }
      }
      showProgress()
    } else if (data.type === 'result') {
      result = data
    }
  }

  // 按字节读取，一行完整了才解析，避免把多字节字符或半行内容拆开
  const readNew = () => {
    const fd = openSync(outputPath(id), 'r')
    try {
      const size = fstatSync(fd).size
      if (size > offset) {
        const chunk = Buffer.alloc(size - offset)
        readSync(fd, chunk, 0, chunk.length, offset)
        offset = size
        pending = Buffer.concat([pending, chunk])
        let newline
        while ((newline = pending.indexOf(10)) >= 0) {
          handleLine(pending.subarray(0, newline).toString('utf8'))
          pending = pending.subarray(newline + 1)
        }
      }
    } finally {
      closeSync(fd)
    }
  }

  // 接上之前就已经不是同一个进程了（比如后端重启期间 agent 结束了）
  const replaced = processStartTime(state.pid) !== state.startedAt
  const timer = setInterval(() => {
    readNew()
    if (!replaced && isRunning(state.pid)) {
      return
    }
    clearInterval(timer)
    readNew()
    if (result && !result.is_error) {
      append(id, {
        type: 'assistant',
        message: { role: 'assistant', content: blocks.map((text) => ({ type: 'text', text })) },
      })
    } else {
      const errors = readFileSync(errorsPath(id), 'utf8').trim()
      append(id, { type: 'system', subtype: 'error', content: result?.result ?? (errors || 'agent 异常结束') })
    }
    rmSync(turnDir(id), { recursive: true, force: true })
    running = undefined
    emit(id, { type: 'status', running: false })
  }, 200)
}

// 后端启动时：接上还在进行的回答；没有 turn/ 但最后一条还是用户消息的，说明 agent 没能启动
export function resumeTurns() {
  for (const id of listSessions()) {
    if (existsSync(statePath(id))) {
      follow(id, JSON.parse(readFileSync(statePath(id), 'utf8')))
    } else if (readTranscript(id).at(-1)?.type === 'user') {
      rmSync(turnDir(id), { recursive: true, force: true })
      appendEntry(id, { type: 'system', subtype: 'error', content: '回答被中断：agent 没能启动' })
    }
  }
}

function processStartTime(pid: number): string | undefined {
  try {
    return execFileSync('ps', ['-o', 'lstart=', '-p', String(pid)], { encoding: 'utf8' }).trim() || undefined
  } catch {
    return undefined
  }
}

function isRunning(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

// 不继承启动后端的环境里与 Claude 相关的设置，只指定 binOS 自己的配置目录
function agentEnv() {
  const env: NodeJS.ProcessEnv = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith('CLAUDE') && !key.startsWith('ANTHROPIC')) {
      env[key] = value
    }
  }
  env.CLAUDE_CONFIG_DIR = path.join(libraryDir, 'claude')
  return env
}

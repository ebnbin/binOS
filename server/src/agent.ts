import { spawn } from 'node:child_process'
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
import { claudeConfigDir, repoDir } from './paths.js'
import { processStartTime } from './process.js'
import {
  appendEntry,
  createSession,
  imagesDir,
  listSessions,
  readSessionInfo,
  readTranscript,
  sessionDir,
  writeSessionInfo,
} from './sessions.js'
import type { ContentBlock, Entry, EntryFields, ImageBlock, TextBlock } from './sessions.js'

// 推给页面的事件：新写入的条目、这一轮到目前为止的进展、是否有回答在进行
export type LiveEvent =
  | { type: 'entry'; index: number; entry: Entry }
  | { type: 'progress'; blocks: ContentBlock[] }
  | { type: 'status'; running: boolean }

// 回答进行期间的 turn/ 目录：agent 的输出直接写进文件，后端重启后能接着读
const turnDir = (id: number) => path.join(sessionDir(id), 'turn')
const outputPath = (id: number) => path.join(turnDir(id), 'claude-output.jsonl')
const errorsPath = (id: number) => path.join(turnDir(id), 'claude-errors.log')
const statePath = (id: number) => path.join(turnDir(id), 'state.json')

// agent 进程的身份：进程号加上启动时间
type TurnState = {
  pid: number
  startedAt: string
}

// 停止时记录的内容，与 Claude Code 一致
const interruptedText = '[Request interrupted by user]'
// 进展里的工具输出只推送开头一段，完整内容在这一轮结束后写进 transcript
const progressOutputLimit = 4000
// Claude 支持的图片格式和保存时用的扩展名
const imageExtensions: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

const listeners = new Map<number, Set<(event: LiveEvent) => void>>()

// 正在进行的回答，按 session 编号：每个 session 同一时间最多一个，不同 session 可以同时进行
type Turn = { pid: number; blocks: ContentBlock[]; stopped: boolean }
const turns = new Map<number, Turn>()

export function subscribe(sessionId: number, listener: (event: LiveEvent) => void) {
  const set = listeners.get(sessionId) ?? new Set()
  set.add(listener)
  listeners.set(sessionId, set)
  return () => {
    set.delete(listener)
  }
}

export function isAnswering(sessionId: number): boolean {
  return turns.has(sessionId)
}

// 当前状态：页面连上时先拿到这个
export function liveState(sessionId: number): LiveEvent[] {
  const turn = turns.get(sessionId)
  if (!turn) {
    return [{ type: 'status', running: false }]
  }
  return [
    { type: 'status', running: true },
    { type: 'progress', blocks: turn.blocks },
  ]
}

function emit(sessionId: number, event: LiveEvent) {
  for (const listener of listeners.get(sessionId) ?? []) {
    listener(event)
  }
}

function append(sessionId: number, fields: EntryFields) {
  const { entry, index } = appendEntry(sessionId, fields)
  emit(sessionId, { type: 'entry', index, entry })
}

// 开始一轮回答，返回 session 编号；这个 session 已有回答在进行时返回 undefined。sessionId 为空时新建 session
export function startTurn(sessionId: number | undefined, text: string): number | undefined {
  if (sessionId !== undefined && turns.has(sessionId)) {
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

// 停止正在进行的回答：结束 agent 所在的整个进程组，包括它在后台启动的任务
export function stopTurn(sessionId: number): boolean {
  const turn = turns.get(sessionId)
  if (!turn) {
    return false
  }
  turn.stopped = true
  try {
    process.kill(-turn.pid, 'SIGTERM')
  } catch {
    // 已经结束了
  }
  return true
}

// 跟进一轮回答：读取输出文件的新增内容并推给页面，直到 agent 进程退出。
// 出现 result 不代表结束：agent 有后台任务时会继续等待，任务结束后接着回答
function follow(id: number, state: TurnState) {
  const turn: Turn = { pid: state.pid, blocks: [], stopped: false }
  turns.set(id, turn)
  emit(id, { type: 'status', running: true })

  // 已完成的条目（结束时按顺序写进 transcript），以及正在生成的文字、刚开始还没拿到参数的工具调用
  const entries: EntryFields[] = []
  let partial = ''
  let startingTool: { id: string; name: string } | undefined
  let result: { is_error?: boolean; result?: string } | undefined
  let offset = 0
  let pending = Buffer.alloc(0)

  const showProgress = () => {
    const blocks: ContentBlock[] = entries.flatMap((entry) =>
      (entry.message!.content as ContentBlock[]).map((block) =>
        block.type === 'tool_result'
          ? {
              ...block,
              content: block.content.map((part) =>
                part.type === 'text' ? { ...part, text: part.text.slice(0, progressOutputLimit) } : part,
              ),
            }
          : block,
      ),
    )
    if (startingTool) {
      blocks.push({ type: 'tool_use', ...startingTool, input: {} })
    }
    if (partial) {
      blocks.push({ type: 'text', text: partial })
    }
    turn.blocks = blocks
    emit(id, { type: 'progress', blocks })
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
      } else if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
        startingTool = { id: event.content_block.id, name: event.content_block.name }
        showProgress()
      } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        partial += event.delta.text
        showProgress()
      }
    } else if (data.type === 'assistant') {
      for (const block of data.message.content) {
        if (block.type === 'text') {
          entries.push({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: block.text }] } })
          partial = ''
        } else if (block.type === 'tool_use') {
          const { id: toolId, name, input } = block
          entries.push({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: toolId, name, input }] } })
          startingTool = undefined
        }
      }
      showProgress()
    } else if (data.type === 'user') {
      for (const block of data.message.content) {
        if (block.type === 'tool_result') {
          entries.push({
            type: 'user',
            message: {
              role: 'user',
              content: [{ type: 'tool_result', tool_use_id: block.tool_use_id, content: resultContent(id, block.tool_use_id, block.content), is_error: block.is_error }],
            },
          })
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
    if (!replaced && processAlive(state.pid)) {
      return
    }
    clearInterval(timer)
    readNew()
    const errors = readFileSync(errorsPath(id), 'utf8').trim()
    rmSync(turnDir(id), { recursive: true, force: true })
    turns.delete(id)
    emit(id, { type: 'status', running: false })

    for (const entry of entries) {
      append(id, entry)
    }
    if (turn.stopped) {
      if (partial) {
        append(id, { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: partial }] } })
      }
      append(id, { type: 'user', message: { role: 'user', content: [{ type: 'text', text: interruptedText }] } })
    } else if (!result || result.is_error) {
      append(id, { type: 'system', subtype: 'error', content: result?.result ?? (errors || 'agent 异常结束') })
    }
  }, 200)
}

// 工具结果可能是文字，也可能是内容块数组。图片存成文件，按工具调用和位置命名，重新读取输出时覆盖同一个文件；
// 其他类型的块只记下类型
function resultContent(sessionId: number, toolUseId: string, content: unknown): (TextBlock | ImageBlock)[] {
  if (typeof content === 'string') {
    return [{ type: 'text', text: content }]
  }
  if (!Array.isArray(content)) {
    return []
  }
  return content.map((block, index): TextBlock | ImageBlock => {
    if (block.type === 'text') {
      return { type: 'text', text: block.text }
    }
    const extension = block.type === 'image' && block.source?.type === 'base64' && imageExtensions[block.source.media_type]
    if (!extension) {
      return { type: 'text', text: `[${block.type}]` }
    }
    const file = `${toolUseId}-${index}.${extension}`
    mkdirSync(imagesDir(sessionId), { recursive: true })
    writeFileSync(path.join(imagesDir(sessionId), file), Buffer.from(block.source.data, 'base64'))
    return { type: 'image', file }
  })
}

// 后端启动时：接上还在进行的回答；没有 turn/ 但最后一条还是用户发来的消息，说明 agent 没能启动
export function resumeTurns() {
  for (const id of listSessions()) {
    if (existsSync(statePath(id))) {
      follow(id, JSON.parse(readFileSync(statePath(id), 'utf8')))
    } else if (typeof readTranscript(id).at(-1)?.message?.content === 'string') {
      rmSync(turnDir(id), { recursive: true, force: true })
      appendEntry(id, { type: 'system', subtype: 'error', content: '回答被中断：agent 没能启动' })
    }
  }
}

function processAlive(pid: number) {
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
  env.CLAUDE_CONFIG_DIR = claudeConfigDir
  return env
}

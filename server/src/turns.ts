import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { spawnClaude } from './claude.js'
import { ClaudeOutput } from './claude-output.js'
import { emit } from './events.js'
import { LineReader } from './line-reader.js'
import { isAlive, isRunning, processStartTime } from './process.js'
import type { ProcessIdentity } from './process.js'
import {
  appendEntry,
  createSession,
  filesDir,
  listSessions,
  readSessionInfo,
  readTranscript,
  sessionDir,
  writeSessionInfo,
} from './sessions.js'
import { interruptedText } from './types.js'
import type { ContentBlock, EntryFields, LiveEvent } from './types.js'

// 一轮回答：用户发来一条消息，agent 回答直到进程退出。每个 session 同一时间最多一轮，不同 session 可以同时进行。
// 回答期间的 turn/ 目录：agent 的输出直接写进文件，state.json 记录 agent 进程，后端重启后能接着读
const turnDir = (id: number) => path.join(sessionDir(id), 'turn')
const outputPath = (id: number) => path.join(turnDir(id), 'claude-output.jsonl')
const errorsPath = (id: number) => path.join(turnDir(id), 'claude-errors.log')
const statePath = (id: number) => path.join(turnDir(id), 'state.json')

// 检查 agent 新输出的间隔
const pollInterval = 200

type Turn = { pid: number; blocks: ContentBlock[]; stopped: boolean }
const turns = new Map<number, Turn>()

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
  const pid = spawnClaude({
    prompt: text,
    claudeSessionId,
    resume: established,
    outputPath: outputPath(id),
    errorsPath: errorsPath(id),
  })
  const startedAt = pid && processStartTime(pid)
  if (!pid || !startedAt) {
    rmSync(turnDir(id), { recursive: true, force: true })
    append(id, { type: 'system', subtype: 'error', content: 'agent 启动失败' })
    return id
  }
  const agent: ProcessIdentity = { pid, startedAt }
  writeFileSync(statePath(id), JSON.stringify(agent) + '\n')
  follow(id, agent)
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

// 后端启动时：接上还在进行的回答；没有 turn/ 但最后一条还是用户发来的消息，说明 agent 没能启动
export function resumeTurns() {
  for (const id of listSessions()) {
    if (existsSync(statePath(id))) {
      follow(id, JSON.parse(readFileSync(statePath(id), 'utf8')))
    } else if (typeof readTranscript(id).at(-1)?.message?.content === 'string') {
      rmSync(turnDir(id), { recursive: true, force: true })
      append(id, { type: 'system', subtype: 'error', content: '回答被中断：agent 没能启动' })
    }
  }
}

// 跟进一轮回答：读取 agent 输出的新内容并推给页面，直到 agent 进程退出，再把这一轮写进 transcript。
// 出现 result 不代表结束：agent 有后台任务时会继续等待，任务结束后接着回答
function follow(id: number, agent: ProcessIdentity) {
  const turn: Turn = { pid: agent.pid, blocks: [], stopped: false }
  turns.set(id, turn)
  emit(id, { type: 'status', running: true })

  const output = new ClaudeOutput((name, data) => {
    mkdirSync(filesDir(id), { recursive: true })
    writeFileSync(path.join(filesDir(id), name), data)
  })
  const reader = new LineReader(outputPath(id))
  const readNew = () => {
    let changed = false
    for (const line of reader.read()) {
      changed = output.push(line) || changed
    }
    if (changed) {
      turn.blocks = output.progress()
      emit(id, { type: 'progress', blocks: turn.blocks })
    }
  }

  // 接上之前就已经不是同一个进程了（比如后端重启期间 agent 结束了）
  const replaced = !isRunning(agent)
  const timer = setInterval(() => {
    readNew()
    if (!replaced && isAlive(agent.pid)) {
      return
    }
    clearInterval(timer)
    readNew()
    const errors = readFileSync(errorsPath(id), 'utf8').trim()
    rmSync(turnDir(id), { recursive: true, force: true })
    turns.delete(id)
    emit(id, { type: 'status', running: false })

    for (const entry of output.entries) {
      append(id, entry)
    }
    if (turn.stopped) {
      if (output.partial) {
        append(id, { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: output.partial }] } })
      }
      append(id, { type: 'user', message: { role: 'user', content: [{ type: 'text', text: interruptedText }] } })
    } else if (!output.result || output.result.is_error) {
      append(id, { type: 'system', subtype: 'error', content: output.result?.result ?? (errors || 'agent 异常结束') })
    }
  }, pollInterval)
}

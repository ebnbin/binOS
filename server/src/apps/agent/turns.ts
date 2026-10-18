import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { spawnClaude } from './claude.js'
import { ClaudeOutput } from './claude-output.js'
import { notifyChange } from '../../events.js'
import { emit } from './live-events.js'
import { LineReader } from '../../line-reader.js'
import { isAlive, isRunning, processStartTime } from '../../process.js'
import type { ProcessIdentity } from '../../process.js'
import { appendRecords, createSession, filesDir, listSessions, readTranscript, sessionDir, sessionInfo } from './sessions.js'
import type { Attachment, Live, TranscriptRecord } from './types.js'
import { moveUploads, promptWithAttachments } from './uploads.js'

// 回答期间的 turn/ 目录：agent 的原始输出和进程身份写在这里，后端重启后能接着读
const turnDir = (id: number) => path.join(sessionDir(id), 'turn')
const outputPath = (id: number) => path.join(turnDir(id), 'claude-output.jsonl')
const errorsPath = (id: number) => path.join(turnDir(id), 'claude-errors.log')
const statePath = (id: number) => path.join(turnDir(id), 'state.json')

const pollInterval = 200

// stopped：用户停止了这一轮，结果记成停止而不是出错
type TurnState = { agent: ProcessIdentity; stopped?: true }
type Turn = { state: TurnState; output: ClaudeOutput }
const turns = new Map<number, Turn>()

export function isAnswering(sessionId: number): boolean {
  return turns.has(sessionId)
}

export function liveState(sessionId: number): Live | null {
  return turns.get(sessionId)?.output.current() ?? null
}

function append(sessionId: number, records: TranscriptRecord[]) {
  if (records.length === 0) {
    return
  }
  const index = appendRecords(sessionId, records)
  records.forEach((record, i) => emit(sessionId, { type: 'record', index: index + i, record }))
}

// 先写临时文件再改名，不会出现写了一半的 state.json
function writeState(sessionId: number, state: TurnState) {
  writeFileSync(`${statePath(sessionId)}.tmp`, JSON.stringify(state) + '\n')
  renameSync(`${statePath(sessionId)}.tmp`, statePath(sessionId))
}

function failTurn(sessionId: number, error: string) {
  append(sessionId, [{ type: 'result', time: new Date().toISOString(), durationMs: 0, outcome: 'error', error }])
}

// 这个 session 已有回答在进行时返回 undefined
export function startTurn(sessionId: number | undefined, text: string, attachments: Attachment[]): number | undefined {
  if (sessionId !== undefined && turns.has(sessionId)) {
    return undefined
  }
  const user: TranscriptRecord = {
    type: 'user',
    time: new Date().toISOString(),
    text,
    ...(attachments.length > 0 && { attachments }),
  }
  let id: number
  if (sessionId === undefined) {
    id = createSession(user)
  } else {
    id = sessionId
    append(id, [user])
  }
  moveUploads(id, attachments)

  // agent 那边的会话建立过就接着它；没建立过（之前都失败了）就开一个新的
  const { agent } = sessionInfo(id)
  mkdirSync(turnDir(id), { recursive: true })
  const pid = spawnClaude({
    prompt: promptWithAttachments(id, text, attachments),
    claudeSessionId: agent?.sessionId ?? randomUUID(),
    resume: agent !== undefined,
    outputPath: outputPath(id),
    errorsPath: errorsPath(id),
  })
  const startedAt = pid && processStartTime(pid)
  if (!pid || !startedAt) {
    rmSync(turnDir(id), { recursive: true, force: true })
    failTurn(id, 'agent 启动失败')
    notifyChange({ type: 'session', id })
    return id
  }
  const state: TurnState = { agent: { pid, startedAt } }
  writeState(id, state)
  follow(id, state)
  notifyChange({ type: 'session', id })
  return id
}

// 结束整个进程组，包括 agent 在后台启动的任务
export function stopTurn(sessionId: number): boolean {
  const turn = turns.get(sessionId)
  if (!turn) {
    return false
  }
  turn.state.stopped = true
  writeState(sessionId, turn.state)
  try {
    process.kill(-turn.state.agent.pid, 'SIGTERM')
  } catch {
    // 已经结束了
  }
  return true
}

// 有 state.json 的接着跟进；没有 state.json 但最后一条是用户的话，说明 agent 没能启动
export function resumeTurns() {
  for (const id of listSessions()) {
    if (existsSync(statePath(id))) {
      follow(id, JSON.parse(readFileSync(statePath(id), 'utf8')))
      continue
    }
    rmSync(turnDir(id), { recursive: true, force: true })
    if (readTranscript(id).at(-1)?.type === 'user') {
      failTurn(id, '回答被中断：agent 没能启动')
    }
  }
}

// 以 agent 进程退出为结束，而不是 result：agent 有后台任务时会等任务结束后接着回答。
// 这一轮已经记下的内容里最大的 offset 之前的输出，重读时只用来恢复状态
function follow(id: number, state: TurnState) {
  const records = readTranscript(id)
  const current = records.slice(records.findLastIndex((record) => record.type === 'user'))
  // 收尾已经记下了，只是没来得及删掉 turn/
  if (current.some((record) => record.type === 'result')) {
    rmSync(turnDir(id), { recursive: true, force: true })
    return
  }
  const recorded = Math.max(0, ...current.map((record) => ('offset' in record && record.offset) || 0))
  const output = new ClaudeOutput({ filesDir: filesDir(id), recorded, sessionId: sessionInfo(id).agent?.sessionId })
  turns.set(id, { state, output })
  emit(id, { type: 'live', live: output.current() })

  const reader = new LineReader(outputPath(id))
  const readNew = () => {
    for (const line of reader.read()) {
      const { records, events } = output.push(line.text, line.end)
      append(id, records)
      for (const event of events) {
        emit(id, event)
      }
    }
  }

  // 接上之前就已经不是同一个进程了（比如后端重启期间 agent 结束了）
  const replaced = !isRunning(state.agent)
  const timer = setInterval(() => {
    readNew()
    if (!replaced && isAlive(state.agent.pid)) {
      return
    }
    clearInterval(timer)
    readNew()
    const errors = existsSync(errorsPath(id)) ? readFileSync(errorsPath(id), 'utf8').trim() : ''
    append(id, output.finish({ startedAt: current[0].time, stopped: Boolean(state.stopped), errors }))
    rmSync(turnDir(id), { recursive: true, force: true })
    turns.delete(id)
    emit(id, { type: 'live', live: null })
    notifyChange({ type: 'session', id })
  }, pollInterval)
}

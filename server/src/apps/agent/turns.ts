import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { closeInput, inputOpen, sendInterrupt, sendMessage as sendToAgent, spawnClaude, stopRelay } from './claude.js'
import type { TurnFiles } from './claude.js'
import { ClaudeOutput } from './claude-output.js'
import { notifyChange } from '../../events.js'
import { emit } from './live-events.js'
import { LineReader } from '../../line-reader.js'
import { isAlive, isRunning, processStartTime } from '../../process.js'
import type { ProcessIdentity } from '../../process.js'
import { appendRecords, createSession, filesDir, listSessions, readTranscript, sessionDir, sessionInfo, setUserState } from './sessions.js'
import { applyChanges, readState } from '../../state.js'
import { limitsKey } from './types.js'
import type { Attachment, Effort, Limits, Live, Model, TranscriptRecord } from './types.js'
import { moveUploads, promptWithAttachments } from './uploads.js'

// 回答期间的 turn/ 目录：给 agent 发消息的管道、agent 的原始输出和进程身份，后端重启后能接着读、接着发
const turnDir = (id: number) => path.join(sessionDir(id), 'turn')
const statePath = (id: number) => path.join(turnDir(id), 'state.json')
const turnFiles = (id: number): TurnFiles => ({
  input: path.join(turnDir(id), 'input.fifo'),
  relay: path.join(turnDir(id), 'relay.pid'),
  output: path.join(turnDir(id), 'claude-output.jsonl'),
  errors: path.join(turnDir(id), 'claude-errors.log'),
})

const pollInterval = 200
// 答完后这么久没人插话、也没有后台任务，就关上输入让 agent 退出
const settleDelay = 1500
// 输入已经关上、agent 正在退出时发来的话，等它退出后开始新的一轮；等不到就结束它，反正已经答完了
const exitWait = 5000

// stopped：用户停止了这一轮，结果记成停止而不是出错
type TurnState = { agent: ProcessIdentity; stopped?: true }
// open：还能往管道里发消息；settledSince：从什么时候起答完了、没有后台任务；finished：这一轮结束了
type Turn = { state: TurnState; output: ClaudeOutput; open: boolean; settledSince?: number; finished: Promise<void> }
const turns = new Map<number, Turn>()

export function isAnswering(sessionId: number): boolean {
  return turns.has(sessionId)
}

export function liveState(sessionId: number): Live | null {
  return turns.get(sessionId)?.output.current() ?? null
}

// 改名记进 transcript，和别的记录一样推给正在看的页面
export function renameSession(sessionId: number, title: string) {
  append(sessionId, [{ type: 'title', time: new Date().toISOString(), title }])
}

// 答完了，在等后台任务
export function isWaiting(sessionId: number): boolean {
  return turns.get(sessionId)?.output.current().status?.type === 'waiting'
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

// interrupt：插话前先打断正在做的事；model、effort：开始新的一轮时用，插话时沿用这一轮的
export type MessageOptions = { interrupt?: boolean; model?: Model; effort?: Effort }

type UserFields = Pick<Extract<TranscriptRecord, { type: 'user' }>, 'interrupt' | 'model' | 'effort'>

function userRecord(text: string, attachments: Attachment[], fields: UserFields = {}): TranscriptRecord {
  return {
    type: 'user',
    time: new Date().toISOString(),
    text,
    ...(attachments.length > 0 && { attachments }),
    ...fields,
  }
}

// 用户发来一句话：没在回答时开始新的一轮；正在回答时交给 agent，它在下一次工具调用之间看到。
// 归档了的 session 又接着聊，就回到列表里。返回 session 编号；交不过去时返回 undefined
export async function sendMessage(
  sessionId: number | undefined,
  text: string,
  attachments: Attachment[],
  options: MessageOptions,
): Promise<number | undefined> {
  if (sessionId === undefined) {
    return startTurn(undefined, text, attachments, options)
  }
  setUserState(sessionId, { archived: undefined })
  for (let attempt = 0; attempt < 3; attempt++) {
    const turn = turns.get(sessionId)
    if (!turn) {
      return startTurn(sessionId, text, attachments, options)
    }
    if (turn.open) {
      return (await insert(sessionId, turn, text, attachments, Boolean(options.interrupt))) ? sessionId : undefined
    }
    const exited = await Promise.race([turn.finished.then(() => true), sleep(exitWait).then(() => false)])
    if (!exited) {
      stopTurn(sessionId)
      await turn.finished
    }
  }
  return undefined
}

async function insert(id: number, turn: Turn, text: string, attachments: Attachment[], interrupt: boolean): Promise<boolean> {
  moveUploads(id, attachments)
  const files = turnFiles(id)
  try {
    if (interrupt) {
      await sendInterrupt(files)
    }
    await sendToAgent(files, promptWithAttachments(id, text, attachments))
  } catch {
    return false
  }
  turn.settledSince = undefined
  append(id, [userRecord(text, attachments, interrupt ? { interrupt } : {})])
  notifyChange({ type: 'session', id })
  return true
}

async function startTurn(sessionId: number | undefined, text: string, attachments: Attachment[], options: MessageOptions): Promise<number> {
  const { model, effort } = options
  const user = userRecord(text, attachments, { ...(model && { model }), ...(effort && { effort }) })
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
  const files = turnFiles(id)
  mkdirSync(turnDir(id), { recursive: true })
  const pid = spawnClaude({ files, claudeSessionId: agent?.sessionId ?? randomUUID(), resume: agent !== undefined, model, effort })
  const startedAt = pid && processStartTime(pid)
  if (!pid || !startedAt) {
    rmSync(turnDir(id), { recursive: true, force: true })
    failTurn(id, 'agent 启动失败')
    notifyChange({ type: 'session', id })
    return id
  }
  const state: TurnState = { agent: { pid, startedAt } }
  writeState(id, state)
  // 第一句话排在写入队列的最前面，之后插的话都在它后面，不用等转发进程就绪
  follow(id, state, true)
  notifyChange({ type: 'session', id })
  // 发不过去时结束 agent，这一轮照常以出错结束
  await sendToAgent(files, promptWithAttachments(id, text, attachments)).catch(() => stopTurn(id))
  return id
}

// 结束整个进程组，包括转发进程和 agent 在后台启动的任务
export function stopTurn(sessionId: number): boolean {
  const turn = turns.get(sessionId)
  if (!turn) {
    return false
  }
  turn.open = false
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

// 额度变了才写进系统状态，各个页面随即收到
function saveLimits(limits: Limits) {
  const current = readState().entries.find((entry) => entry.key === limitsKey)?.value as Limits | undefined
  const { updatedAt: _, ...next } = limits
  const { updatedAt: __, ...previous } = current ?? {}
  if (JSON.stringify(next) !== JSON.stringify(previous)) {
    applyChanges([{ key: limitsKey, value: limits }])
  }
}

// 以 agent 进程退出为结束，而不是 result：答完后还会接着处理插的话，有后台任务时等任务结束后接着回答。
// 这一轮已经记下的内容里最大的 offset 之前的输出，重读时只用来恢复状态。后端重启后接上的，看管道和转发进程还在不在
function follow(id: number, state: TurnState, open = inputOpen(turnFiles(id))) {
  const records = readTranscript(id)
  // 收尾已经记下了，只是没来得及删掉 turn/
  if (records.at(-1)?.type === 'result') {
    rmSync(turnDir(id), { recursive: true, force: true })
    return
  }
  const current = records.slice(records.findLastIndex((record) => record.type === 'result') + 1)
  const recorded = Math.max(0, ...current.map((record) => ('offset' in record && record.offset) || 0))
  const output = new ClaudeOutput({ filesDir: filesDir(id), recorded, sessionId: sessionInfo(id).agent?.sessionId })
  const files = turnFiles(id)
  let finish!: () => void
  const turn: Turn = { state, output, open, finished: new Promise((resolve) => (finish = resolve)) }
  turns.set(id, turn)
  emit(id, { type: 'live', live: output.current() })

  const reader = new LineReader(files.output)
  const readNew = () => {
    for (const line of reader.read()) {
      const { records, events, limits } = output.push(line.text, line.end)
      if (limits) {
        saveLimits(limits)
      }
      append(id, records)
      for (const event of events) {
        emit(id, event)
      }
    }
  }
  // 答完、没有后台任务，又过了一会儿没人插话：关上输入
  const settle = () => {
    if (!turn.open || !output.answered || output.backgroundTasks() > 0) {
      turn.settledSince = undefined
      return
    }
    turn.settledSince ??= Date.now()
    if (Date.now() - turn.settledSince >= settleDelay) {
      turn.open = false
      void closeInput(files)
    }
  }

  // 接上之前就已经不是同一个进程了（比如后端重启期间 agent 结束了）
  const replaced = !isRunning(state.agent)
  const timer = setInterval(() => {
    readNew()
    if (!replaced && isAlive(state.agent.pid)) {
      settle()
      return
    }
    clearInterval(timer)
    readNew()
    turn.open = false
    const errors = existsSync(files.errors) ? readFileSync(files.errors, 'utf8').trim() : ''
    append(id, output.finish({ startedAt: current[0].time, stopped: Boolean(state.stopped), errors }))
    // 转发进程正常情况下已经结束；agent 异常退出时它还在
    stopRelay(files)
    rmSync(turnDir(id), { recursive: true, force: true })
    turns.delete(id)
    finish()
    emit(id, { type: 'live', live: null })
    notifyChange({ type: 'session', id })
  }, pollInterval)
}

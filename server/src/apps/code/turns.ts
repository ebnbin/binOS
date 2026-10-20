import { setTimeout as sleep } from 'node:timers/promises'
import { notifyChange } from '../../events.js'
import { fitOptions, resumeRuns, startRun } from '../../services/agent/index.js'
import type { Run, RunHandler } from '../../services/agent/index.js'
import { defaultProvider } from '../../services/agent/types.js'
import type { Provider } from '../../services/agent/types.js'
import { emit } from './live-events.js'
import { replyFilesPrompt, snapshotFiles } from './reply-files.js'
import { repoDir } from './repositories.js'
import { appendRecords, createSession, filesDir, listSessions, readTranscript, sessionExists, sessionInfo, setUserState } from './sessions.js'
import type { Attachment, Live, QueuedMessage, TranscriptRecord } from './types.js'
import { recordQuotaSample } from './usage.js'
import { pushQueue, readQueue, takeQueue, unshiftQueue } from './queue.js'
import { discardUploads, moveUploads, promptWithAttachments } from './uploads.js'

// 一轮回答是 agent 的一次运行。session 编号就是运行的 ref
const owner = 'code'

// 输入已经关上、agent 正在退出时发来的话，等它退出后开始新的一轮；等不到就结束它，反正已经答完了
const exitWait = 5000

const turns = new Map<number, Run>()
// 答完了在等后台任务的 session：刚进入这个状态时发出排着的话
const waitingSessions = new Set<number>()
// 正在写的那段文字里引用的本机文件的快照：路径 → 快照文件名
const liveFiles = new Map<number, Record<string, string>>()

export function isAnswering(sessionId: number): boolean {
  return turns.has(sessionId)
}

export function liveState(sessionId: number): Live | null {
  const run = turns.get(sessionId)
  return run ? { ...run.live(), files: liveFiles.get(sessionId) ?? {} } : null
}

// 改名记进 transcript，和别的记录一样推给正在看的页面
export function renameSession(sessionId: number, title: string) {
  append(sessionId, [{ type: 'title', time: new Date().toISOString(), title }])
}

// 答完了，在等后台任务
export function isWaiting(sessionId: number): boolean {
  return turns.get(sessionId)?.live().status?.type === 'waiting'
}

// 回复的文字引用的本机文件存好快照，记在这条记录上
function append(sessionId: number, records: TranscriptRecord[]) {
  if (records.length === 0) {
    return
  }
  const withFiles = records.map((record) => {
    if (record.type !== 'text') {
      return record
    }
    const files = snapshotFiles(record.text, filesDir(sessionId))
    return Object.keys(files).length > 0 ? { ...record, files } : record
  })
  const index = appendRecords(sessionId, withFiles)
  withFiles.forEach((record, i) => emit(sessionId, { type: 'record', index: index + i, record }))
}

function failTurn(sessionId: number, error: string) {
  append(sessionId, [{ type: 'result', time: new Date().toISOString(), durationMs: 0, outcome: 'error', error }])
}

function handler(sessionId: number): RunHandler {
  return {
    records: (records) => {
      append(sessionId, records)
      // 正在写的文字成了记录，它引用的文件也跟着记下了
      if (!turns.get(sessionId)?.live().text) {
        liveFiles.delete(sessionId)
      }
    },
    event: (event) => {
      emit(sessionId, event)
      // 刚答完、开始等后台任务：排着的话交给 agent，它接着答
      if (event.type === 'status') {
        const waiting = event.status?.type === 'waiting'
        if (waiting && !waitingSessions.has(sessionId)) {
          drainQueue(sessionId)
        }
        if (waiting) {
          waitingSessions.add(sessionId)
        } else {
          waitingSessions.delete(sessionId)
        }
      }
      // 文字里刚写完一个本机文件的引用，马上存快照，页面随即就能显示
      const run = turns.get(sessionId)
      if (event.type === 'text' && event.text.includes(')') && run) {
        const known = liveFiles.get(sessionId) ?? {}
        for (const [reference, name] of Object.entries(snapshotFiles(run.live().text, filesDir(sessionId), known))) {
          known[reference] = name
          emit(sessionId, { type: 'file', path: reference, name })
        }
        liveFiles.set(sessionId, known)
      }
    },
    finished: () => {
      turns.delete(sessionId)
      waitingSessions.delete(sessionId)
      liveFiles.delete(sessionId)
      emit(sessionId, { type: 'live', live: null })
      // 先记下额度的点，页面收到通知读到的用量才是新的
      if (sessionInfo(sessionId).provider === 'claude') {
        recordQuotaSample()
      }
      notifyChange({ type: 'session', id: sessionId })
      // 被停止、出错的一轮不接着发，排着的话留给用户决定
      if (!sessionInfo(sessionId).outcome) {
        drainQueue(sessionId)
      }
    },
  }
}

// interrupt：插话前先打断正在做的事；provider：新的 session 用哪个 agent，已有的 session 沿用它的；
// model、effort：开始新的一轮时用，插话时沿用这一轮的
export type MessageOptions = { interrupt?: boolean; provider?: Provider; model?: string; effort?: string }

type UserFields = Pick<Extract<TranscriptRecord, { type: 'user' }>, 'interrupt' | 'provider' | 'model' | 'effort'>

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
    const run = turns.get(sessionId)
    if (!run) {
      return startTurn(sessionId, text, attachments, options)
    }
    if (run.open) {
      return (await insert(sessionId, run, text, attachments, Boolean(options.interrupt))) ? sessionId : undefined
    }
    const exited = await Promise.race([run.finished.then(() => true), sleep(exitWait).then(() => false)])
    if (!exited) {
      run.stop()
      await run.finished
    }
  }
  return undefined
}

async function insert(id: number, run: Run, text: string, attachments: Attachment[], interrupt: boolean): Promise<boolean> {
  moveUploads(id, attachments)
  if (!(await run.send(promptWithAttachments(id, text, attachments, run.provider), { interrupt }))) {
    return false
  }
  append(id, [userRecord(text, attachments, interrupt ? { interrupt } : {})])
  notifyChange({ type: 'session', id })
  return true
}

function startTurn(sessionId: number | undefined, text: string, attachments: Attachment[], options: MessageOptions): number {
  const provider = sessionId === undefined ? (options.provider ?? defaultProvider) : sessionInfo(sessionId).provider
  // 别的 agent 的模型和思考程度不适用，用默认的
  const { model, effort } = fitOptions(provider, options)
  const user = userRecord(text, attachments, { ...(provider !== defaultProvider && { provider }), ...(model && { model }), ...(effort && { effort }) })
  let id: number
  if (sessionId === undefined) {
    id = createSession(user)
  } else {
    id = sessionId
    append(id, [user])
  }
  moveUploads(id, attachments)

  // agent 那边的会话建立过就接着它；没建立过（之前都失败了）就开一个新的
  const runOptions = { provider, cwd: repoDir, filesDir: filesDir(id), resume: sessionInfo(id).agent?.sessionId, instructions: replyFilesPrompt, model, effort }
  const run = startRun(owner, String(id), runOptions, promptWithAttachments(id, text, attachments, provider), handler(id))
  if (!run) {
    failTurn(id, 'agent 启动失败')
  } else {
    turns.set(id, run)
    emit(id, { type: 'live', live: liveState(id) })
  }
  notifyChange({ type: 'session', id })
  return id
}

// 排到这一轮答完之后再发；没在回答（包括答完了在等后台任务）时和直接发一样。返回 session 编号，交不过去时返回 undefined
export async function queueMessage(sessionId: number, text: string, attachments: Attachment[], options: MessageOptions): Promise<number | undefined> {
  if (!isAnswering(sessionId) || isWaiting(sessionId)) {
    return sendMessage(sessionId, text, attachments, options)
  }
  const { model, effort } = options
  pushQueue(sessionId, {
    time: new Date().toISOString(),
    text,
    ...(attachments.length > 0 && { attachments }),
    ...(model && { model }),
    ...(effort && { effort }),
  })
  notifyChange({ type: 'session', id: sessionId })
  return sessionId
}

// 撤回一条排队的消息，返回它的文字；已经发出去了时返回 undefined
export function unqueueMessage(sessionId: number, itemId: string): string | undefined {
  const message = takeQueue(sessionId, itemId)
  if (!message) {
    return undefined
  }
  discardUploads(message.attachments ?? [])
  notifyChange({ type: 'session', id: sessionId })
  return message.text
}

// 现在就发一条排队的消息（被停止或出错后留下的）
export async function sendQueued(sessionId: number, itemId: string): Promise<number | undefined> {
  const message = takeQueue(sessionId, itemId)
  return message && sendTaken(sessionId, message)
}

// 把排在最前面的一条发出去，后面的等它答完再发
function drainQueue(sessionId: number) {
  const message = takeQueue(sessionId)
  if (message) {
    void sendTaken(sessionId, message).catch((error: unknown) => console.error(error))
  }
}

// 发不出去就放回队列
async function sendTaken(sessionId: number, message: QueuedMessage): Promise<number | undefined> {
  const { text, attachments = [], model, effort } = message
  let sent: number | undefined
  try {
    sent = await sendMessage(sessionId, text, attachments, { model, effort })
  } finally {
    if (sent === undefined) {
      unshiftQueue(sessionId, message)
      notifyChange({ type: 'session', id: sessionId })
    }
  }
  return sent
}

export function stopTurn(sessionId: number): boolean {
  const run = turns.get(sessionId)
  run?.stop()
  return Boolean(run)
}

// 接着跟进后端重启前还在进行的回答，从这一轮已经记下的最大 offset 之后接着记。
// 还在一轮里、又没有在进行的运行的，是 agent 没能启动
export function resumeTurns() {
  const resumed = resumeRuns(owner, (ref) => {
    const id = Number(ref)
    const records = sessionExists(id) ? readTranscript(id) : []
    // 收尾已经记下了
    if (records.length === 0 || records.at(-1)?.type === 'result') {
      return undefined
    }
    const current = records.slice(records.findLastIndex((record) => record.type === 'result') + 1)
    const recorded = Math.max(0, ...current.map((record) => ('offset' in record && record.offset) || 0))
    return { recorded, handler: handler(id) }
  })
  for (const { ref, run } of resumed) {
    turns.set(Number(ref), run)
  }
  for (const id of listSessions()) {
    if (!turns.has(id) && sessionInfo(id).inTurn) {
      failTurn(id, '回答被中断：agent 没能启动')
    }
    // 后端在一轮答完、排着的话还没发出时重启了
    if (!turns.has(id) && !sessionInfo(id).outcome && readQueue(id).length > 0) {
      drainQueue(id)
    }
  }
}

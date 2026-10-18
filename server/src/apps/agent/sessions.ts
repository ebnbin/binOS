import {
  appendFileSync,
  closeSync,
  existsSync,
  fstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { sessionsDir } from '../../paths.js'
import type { Context, TranscriptRecord } from './types.js'

// session.json：从 transcript 算出来的缓存，会话列表和启动 agent 时用。
// transcriptSize 是算的时候 transcript 有多大，对不上就从头重算，丢了也能重建
export type SessionInfo = {
  transcriptSize: number
  count: number
  title: string
  createdAt: string
  updatedAt: string
  turns: number
  // 最后一轮还没结束：之后的 user 是插话，不算新的一轮
  inTurn: boolean
  agent?: { provider: 'claude'; sessionId: string }
  outcome?: 'stopped' | 'error'
  context?: Context
}

export const sessionDir = (id: number) => path.join(sessionsDir, String(id))
export const filesDir = (id: number) => path.join(sessionDir(id), 'files')
const infoPath = (id: number) => path.join(sessionDir(id), 'session.json')
const transcriptPath = (id: number) => path.join(sessionDir(id), 'transcript.jsonl')

export function listSessions(): number[] {
  if (!existsSync(sessionsDir)) {
    return []
  }
  return readdirSync(sessionsDir)
    .filter((name) => /^\d+$/.test(name))
    .map(Number)
    .filter(sessionExists)
    .sort((a, b) => b - a)
}

export function sessionExists(id: number): boolean {
  return Number.isSafeInteger(id) && id > 0 && existsSync(transcriptPath(id))
}

// 只有这个后端写 session（根目录锁保证），同步地建目录、写第一条，编号不会被占
export function createSession(first: TranscriptRecord): number {
  const id = (listSessions()[0] ?? 0) + 1
  mkdirSync(sessionDir(id), { recursive: true })
  appendRecords(id, [first])
  return id
}

// 最后一行可能是崩溃时没写完的半行，跳过
export function readTranscript(id: number): TranscriptRecord[] {
  if (!existsSync(transcriptPath(id))) {
    return []
  }
  const records: TranscriptRecord[] = []
  for (const line of readFileSync(transcriptPath(id), 'utf8').split('\n')) {
    try {
      records.push(JSON.parse(line))
    } catch {
      // 空行或没写完的半行
    }
  }
  return records
}

function emptyInfo(): SessionInfo {
  return { transcriptSize: 0, count: 0, title: '', createdAt: '', updatedAt: '', turns: 0, inTurn: false }
}

function apply(info: SessionInfo, record: TranscriptRecord) {
  info.count += 1
  info.updatedAt = record.time
  info.createdAt ||= record.time
  switch (record.type) {
    case 'user':
      if (info.turns === 0) {
        info.title = (record.text.trim() || record.attachments?.[0]?.name || '').slice(0, 200)
      }
      if (!info.inTurn) {
        info.turns += 1
        info.inTurn = true
        delete info.outcome
      }
      break
    case 'agent':
      info.agent = { provider: record.provider, sessionId: record.sessionId }
      break
    case 'result':
      info.inTurn = false
      if (record.outcome) {
        info.outcome = record.outcome
      }
      if (record.context) {
        info.context = record.context
      }
      break
  }
}

// 先写临时文件再改名，不会出现写了一半的 session.json
function writeInfo(id: number, info: SessionInfo) {
  writeFileSync(`${infoPath(id)}.tmp`, JSON.stringify(info, null, 2) + '\n')
  renameSync(`${infoPath(id)}.tmp`, infoPath(id))
}

function readInfoFile(id: number): SessionInfo | undefined {
  try {
    return JSON.parse(readFileSync(infoPath(id), 'utf8'))
  } catch {
    return undefined
  }
}

function transcriptSize(id: number): number {
  try {
    return statSync(transcriptPath(id)).size
  } catch {
    return 0
  }
}

// 内存里记着每个 session 算到哪了，追加时接着算；后端刚启动时先看 session.json，和 transcript 对得上就直接用
const infos = new Map<number, SessionInfo>()

export function sessionInfo(id: number): SessionInfo {
  const size = transcriptSize(id)
  const cached = infos.get(id) ?? readInfoFile(id)
  if (cached?.transcriptSize === size) {
    infos.set(id, cached)
    return cached
  }
  const info = emptyInfo()
  for (const record of readTranscript(id)) {
    apply(info, record)
  }
  info.transcriptSize = size
  writeInfo(id, info)
  infos.set(id, info)
  return info
}

// 崩溃时没写完的半行后面先换行，不和新的记录连在一起
function endsWithNewline(id: number): boolean {
  const fd = openSync(transcriptPath(id), 'r')
  try {
    const size = fstatSync(fd).size
    const last = Buffer.alloc(1)
    return size === 0 || (readSync(fd, last, 0, 1, size - 1) === 1 && last[0] === 10)
  } finally {
    closeSync(fd)
  }
}

// 同一行输出产生的几条记录一次写进去，后端重启时不会只记下其中一部分。返回第一条是第几条
export function appendRecords(id: number, records: TranscriptRecord[]): number {
  const exists = existsSync(transcriptPath(id))
  const info = exists ? sessionInfo(id) : emptyInfo()
  const index = info.count
  const lines = records.map((record) => JSON.stringify(record) + '\n').join('')
  appendFileSync(transcriptPath(id), exists && !endsWithNewline(id) ? '\n' + lines : lines)
  for (const record of records) {
    apply(info, record)
  }
  info.transcriptSize = transcriptSize(id)
  writeInfo(id, info)
  infos.set(id, info)
  return index
}

import { randomUUID } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { libraryDir } from './paths.js'

// transcript.jsonl 的每一行是一个条目，字段沿用 Claude Code 会话记录的命名，sessionId 是 binOS 的 session 编号
export type Entry = {
  type: 'user' | 'assistant' | 'system'
  uuid: string
  parentUuid: string | null
  sessionId: number
  timestamp: string
  message?: {
    role: 'user' | 'assistant'
    content: string | { type: 'text'; text: string }[]
  }
  subtype?: string
  content?: string
}

type EntryFields = Pick<Entry, 'type' | 'message' | 'subtype' | 'content'>

export type SessionInfo = {
  claudeSessionId: string
}

const sessionsDir = path.join(libraryDir, 'agent', 'sessions')
const sessionDir = (id: number) => path.join(sessionsDir, String(id))
const infoPath = (id: number) => path.join(sessionDir(id), 'session.json')
const transcriptPath = (id: number) => path.join(sessionDir(id), 'transcript.jsonl')

// 所有 session 的编号，新的在前
export function listSessions(): number[] {
  if (!existsSync(sessionsDir)) {
    return []
  }
  return readdirSync(sessionsDir)
    .filter((name) => /^\d+$/.test(name))
    .map(Number)
    .sort((a, b) => b - a)
}

export function sessionExists(id: number): boolean {
  return existsSync(infoPath(id))
}

export function createSession(info: SessionInfo): number {
  const id = (listSessions()[0] ?? 0) + 1
  mkdirSync(sessionDir(id), { recursive: true })
  writeSessionInfo(id, info)
  return id
}

export function readSessionInfo(id: number): SessionInfo {
  return JSON.parse(readFileSync(infoPath(id), 'utf8'))
}

export function writeSessionInfo(id: number, info: SessionInfo) {
  writeFileSync(infoPath(id), JSON.stringify(info, null, 2) + '\n')
}

export function readTranscript(id: number): Entry[] {
  if (!existsSync(transcriptPath(id))) {
    return []
  }
  return readFileSync(transcriptPath(id), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

// 追加一个条目，返回它和它在 transcript 中的位置
export function appendEntry(id: number, fields: EntryFields): { entry: Entry; index: number } {
  const transcript = readTranscript(id)
  const { type, ...rest } = fields
  const entry: Entry = {
    type,
    uuid: randomUUID(),
    parentUuid: transcript.at(-1)?.uuid ?? null,
    sessionId: id,
    timestamp: new Date().toISOString(),
    ...rest,
  }
  appendFileSync(transcriptPath(id), JSON.stringify(entry) + '\n')
  return { entry, index: transcript.length }
}

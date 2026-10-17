import { randomUUID } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { sessionsDir } from '../../paths.js'
import type { Entry, EntryFields, SessionSummary } from './types.js'

export type SessionInfo = {
  claudeSessionId: string
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
  return Number.isSafeInteger(id) && id > 0 && existsSync(infoPath(id))
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

// 追加时不用重读整个 transcript。只有这个后端写 transcript（根目录锁保证），所以缓存不会过期
const tails = new Map<number, { count: number; lastUuid: string | null }>()

export function appendEntry(id: number, fields: EntryFields): { entry: Entry; index: number } {
  let tail = tails.get(id)
  if (!tail) {
    const transcript = readTranscript(id)
    tail = { count: transcript.length, lastUuid: transcript.at(-1)?.uuid ?? null }
    tails.set(id, tail)
  }
  const { type, ...rest } = fields
  const entry: Entry = {
    type,
    uuid: randomUUID(),
    parentUuid: tail.lastUuid,
    sessionId: id,
    timestamp: new Date().toISOString(),
    ...rest,
  }
  appendFileSync(transcriptPath(id), JSON.stringify(entry) + '\n')
  const index = tail.count
  tail.count += 1
  tail.lastUuid = entry.uuid
  return { entry, index }
}

export function sessionSummary(id: number): Omit<SessionSummary, 'running'> {
  const transcript = readTranscript(id)
  const firstEntry = transcript.find((entry) => entry.type === 'user')
  const first = firstEntry?.message?.content
  const text = typeof first === 'string' ? first : (first?.find((block) => block.type === 'text')?.text ?? '')
  const title = text.trim() || firstEntry?.attachments?.[0]?.name || ''
  return { id, title: title.slice(0, 200), updatedAt: transcript.at(-1)?.timestamp ?? null }
}

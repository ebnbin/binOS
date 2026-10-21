import { randomUUID } from 'node:crypto'
import type { Entry } from './types.js'

export type SessionMetadata = Extract<Entry, { type: 'session' }> & { format: 1; id: string }

export type Event = {
  seq: number
  id: string
  turnId: string | null
  itemId: string | null
  type: 'session.created' | 'turn.started' | 'turn.finished' | 'vendor.bound' | 'item.started' | 'item.completed' | 'item.added'
  data: Entry
}

export type Turn = { id: string; startedAt: string; finishedAt?: string; outcome?: 'stopped' | 'error'; error?: string }
export type Item = { id: string; turnId: string | null; kind: 'input' | 'text' | 'thinking' | 'tool' | 'compact'; entries: Entry[] }

// 原始协议的一行可能生成多条记录；它们作为同一批提交，重启时才能按 offset 安全地去重。
export type EventBatch = { events: Event[] }

export function encodeEntries(entries: Entry[], previous: Event | undefined): Event[] {
  let turnId = previous?.turnId ?? null
  let seq = (previous?.seq ?? 0) + 1
  return entries.map((data) => {
    if (data.type === 'input' && data.mode === 'start') turnId = randomUUID()
    const type = data.type === 'session' ? 'session.created'
      : data.type === 'input' && data.mode === 'start' ? 'turn.started'
      : data.type === 'turn_end' ? 'turn.finished'
      : data.type === 'agent_session' ? 'vendor.bound'
      : data.type === 'tool_call' ? 'item.started'
      : data.type === 'tool_result' ? 'item.completed'
      : 'item.added'
    const itemId = data.type === 'session' || data.type === 'turn_end' || data.type === 'agent_session' ? null
      : data.type === 'tool_call' ? `${turnId}:${data.id}`
      : data.type === 'tool_result' ? `${turnId}:${data.callId}`
      : randomUUID()
    return { seq: seq++, id: randomUUID(), turnId, itemId, type, data }
  })
}

export function projectTurns(events: Event[]): Turn[] {
  const turns = new Map<string, Turn>()
  for (const event of events) {
    if (!event.turnId) continue
    if (event.type === 'turn.started') turns.set(event.turnId, { id: event.turnId, startedAt: event.data.time })
    if (event.data.type === 'turn_end') {
      const turn = turns.get(event.turnId)
      if (turn) Object.assign(turn, { finishedAt: event.data.time, outcome: event.data.outcome, error: event.data.error })
    }
  }
  return [...turns.values()]
}

export function projectItems(events: Event[]): Item[] {
  const items = new Map<string, Item>()
  for (const { itemId, turnId, data } of events) {
    if (!itemId || data.type === 'session' || data.type === 'turn_end' || data.type === 'agent_session') continue
    const kind = data.type === 'tool_call' || data.type === 'tool_result' ? 'tool' : data.type
    const item = items.get(itemId) ?? { id: itemId, turnId, kind, entries: [] }
    item.entries.push(data)
    items.set(itemId, item)
  }
  return [...items.values()]
}

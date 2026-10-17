// 每个 session 的实时推送：/api/apps/agent/sessions/:id/stream 的订阅者
import type { LiveEvent } from './types.js'

const listeners = new Map<number, Set<(event: LiveEvent) => void>>()

export function subscribe(sessionId: number, listener: (event: LiveEvent) => void): () => void {
  let set = listeners.get(sessionId)
  if (!set) {
    set = new Set()
    listeners.set(sessionId, set)
  }
  set.add(listener)
  return () => {
    set.delete(listener)
    if (set.size === 0) {
      listeners.delete(sessionId)
    }
  }
}

export function emit(sessionId: number, event: LiveEvent) {
  for (const listener of listeners.get(sessionId) ?? []) {
    listener(event)
  }
}

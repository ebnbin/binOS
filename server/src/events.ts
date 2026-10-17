import type { LiveEvent } from './types.js'

// 每个 session 的实时事件订阅者
const listeners = new Map<number, Set<(event: LiveEvent) => void>>()

// 返回取消订阅的函数
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

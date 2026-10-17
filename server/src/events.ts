import type { ChangeEvent, LiveEvent } from './types.js'

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

// 页面通过 /api/events 收到的全局通知
const changeListeners = new Set<(event: ChangeEvent) => void>()

export function onChange(listener: (event: ChangeEvent) => void): () => void {
  changeListeners.add(listener)
  return () => changeListeners.delete(listener)
}

export function notifyChange(event: ChangeEvent) {
  for (const listener of changeListeners) {
    listener(event)
  }
}

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

// 对话列表的变化：新建、开始回答、回答结束。只通知是哪个 session，页面收到后重新读取列表
const changeListeners = new Set<(sessionId: number) => void>()

export function onSessionChanged(listener: (sessionId: number) => void): () => void {
  changeListeners.add(listener)
  return () => changeListeners.delete(listener)
}

export function notifySessionChanged(sessionId: number) {
  for (const listener of changeListeners) {
    listener(sessionId)
  }
}

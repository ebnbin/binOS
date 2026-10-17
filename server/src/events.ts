import type { ChangeEvent } from './types.js'

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

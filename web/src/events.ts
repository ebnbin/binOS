import type { ChangeEvent } from '@binos/server/types'
import { useSyncExternalStore } from 'react'
import { eventsUrl } from './api.ts'
import { connectEventSource } from './eventSource.ts'

// 整个页面只连一条全局通知。重连后订阅者收到 null，表示期间可能漏了通知，应全部重新读取
type Listener = (sessionId: number | null) => void

const listeners = new Set<Listener>()
const connectionListeners = new Set<() => void>()
let connected = true
let started = false

function start() {
  if (started) {
    return
  }
  started = true
  let opened = false
  connectEventSource(eventsUrl, {
    onOpen: () => {
      if (opened) {
        listeners.forEach((listener) => listener(null))
      }
      opened = true
    },
    onMessage: (data) => {
      const event: ChangeEvent = JSON.parse(data)
      listeners.forEach((listener) => listener(event.id))
    },
    onConnectedChange: (value) => {
      connected = value
      connectionListeners.forEach((listener) => listener())
    },
  })
}

export function onSessionChanged(listener: Listener): () => void {
  listeners.add(listener)
  start()
  return () => listeners.delete(listener)
}

function subscribeConnection(listener: () => void) {
  connectionListeners.add(listener)
  start()
  return () => connectionListeners.delete(listener)
}

export function useConnected(): boolean {
  return useSyncExternalStore(subscribeConnection, () => connected)
}

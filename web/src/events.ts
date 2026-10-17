import type { ChangeEvent } from '@binos/server/types'
import { useSyncExternalStore } from 'react'
import { eventsUrl, getVersion } from './api.ts'
import { connectEventSource } from './eventSource.ts'

// 整个页面只连一条全局通知。重连后订阅者收到 null，表示期间可能漏了通知，应全部重新读取
type Listener = (sessionId: number | null) => void

const listeners = new Set<Listener>()
const connectionListeners = new Set<() => void>()
let connected = true
// 页面打开期间上线了新版本。连接断开再连上通常就是后端重启了，这时比较版本
let updated = false
let version: string | undefined
let started = false

const notifyConnection = () => connectionListeners.forEach((listener) => listener())

async function checkVersion() {
  const current = await getVersion()
  if (current === undefined) {
    return
  }
  if (version === undefined) {
    version = current
  } else if (current !== version && !updated) {
    updated = true
    notifyConnection()
  }
}

function start() {
  if (started) {
    return
  }
  started = true
  let opened = false
  connectEventSource(eventsUrl, {
    onOpen: () => {
      void checkVersion()
      if (opened) {
        listeners.forEach((listener) => listener(null))
      }
      opened = true
    },
    onMessage: (data) => {
      const event: ChangeEvent = JSON.parse(data)
      if (event.type === 'session') {
        listeners.forEach((listener) => listener(event.id))
      }
    },
    onConnectedChange: (value) => {
      connected = value
      notifyConnection()
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

export function useUpdated(): boolean {
  return useSyncExternalStore(subscribeConnection, () => updated)
}

import type { ContentBlock, Entry, LiveEvent } from '@binos/server/types'
import { useEffect, useState } from 'react'
import { streamUrl } from './api.ts'

export type SessionState = {
  entries: Entry[]
  progress: ContentBlock[] | null
  running: boolean
}

const initialState: SessionState = { entries: [], progress: null, running: false }

export function useSession(sessionId: number | null): SessionState {
  const [state, setState] = useState(initialState)

  useEffect(() => {
    if (sessionId === null) {
      return
    }
    // 断线时浏览器自己重连，用 Last-Event-ID 接着补发；连接被拒绝（比如登录过期）时浏览器不再重连，隔一会儿从 count 重新连接
    let count = 0
    let source: EventSource | undefined
    let retry: number | undefined
    const connect = () => {
      source = new EventSource(streamUrl(sessionId, count))
      source.onmessage = (message) => {
        const event: LiveEvent = JSON.parse(message.data)
        if (event.type === 'entry') {
          if (event.index === count) {
            count += 1
            setState((prev) => ({ ...prev, entries: [...prev.entries, event.entry] }))
          }
        } else if (event.type === 'progress') {
          setState((prev) => ({ ...prev, progress: event.blocks }))
        } else {
          setState((prev) => ({ ...prev, running: event.running, progress: event.running ? prev.progress : null }))
        }
      }
      source.onerror = () => {
        if (source?.readyState === EventSource.CLOSED) {
          retry = window.setTimeout(connect, 3000)
        }
      }
    }
    connect()
    return () => {
      source?.close()
      window.clearTimeout(retry)
    }
  }, [sessionId])

  return state
}

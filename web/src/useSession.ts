import type { ContentBlock, Entry, LiveEvent } from '@binos/server/types'
import { useEffect, useState } from 'react'
import { streamUrl } from './api.ts'

export type SessionState = {
  entries: Entry[]
  // 正在进行的这一轮到目前为止的进展
  progress: ContentBlock[] | null
  running: boolean
}

const initialState: SessionState = { entries: [], progress: null, running: false }

// 一个 session 的实时状态：连上实时推送，先收到补发的条目，再收到实时事件。sessionId 为 null 时是还没有 session 的新对话
export function useSession(sessionId: number | null): SessionState {
  const [state, setState] = useState(initialState)

  useEffect(() => {
    if (sessionId === null) {
      return
    }
    // 已经收到的条数：浏览器断线重连时由 Last-Event-ID 接着补发；连接被拒绝时浏览器不再重连，隔一会儿从这里重新连接
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

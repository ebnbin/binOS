import type { ContentBlock, Entry, LiveEvent } from '@binos/server/apps/agent/types'
import { useEffect, useState } from 'react'
import { streamUrl } from './api.ts'
import { connectEventSource } from '../../eventSource.ts'

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
    // 浏览器自己重连时用 Last-Event-ID 接着补发；由 connectEventSource 重连时从已收到的条数接着补发
    let count = 0
    return connectEventSource(() => streamUrl(sessionId, count), {
      onMessage: (data) => {
        const event: LiveEvent = JSON.parse(data)
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
      },
    })
  }, [sessionId])

  return state
}

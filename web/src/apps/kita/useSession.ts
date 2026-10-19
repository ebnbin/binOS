import type { Live, LiveEvent, TranscriptRecord } from '@binos/server/apps/kita/types'
import { useEffect, useState } from 'react'
import { streamUrl } from './api.ts'
import { connectEventSource } from '../../eventSource.ts'

// live 是回答进行中的临时内容，null 表示没在回答
export type SessionState = {
  records: TranscriptRecord[]
  live: Live | null
}

const initialState: SessionState = { records: [], live: null }

// 写进 transcript 的思考和文字取代对应的临时内容，和后端一致
function applyRecord(live: Live | null, record: TranscriptRecord): Live | null {
  if (!live || ('parent' in record && record.parent)) {
    return live
  }
  if (record.type === 'text') {
    return { ...live, text: '', files: {} }
  }
  if (record.type === 'thinking') {
    return { ...live, thinking: '' }
  }
  return live
}

function applyEvent(state: SessionState, event: Exclude<LiveEvent, { type: 'record' }>): SessionState {
  if (event.type === 'live') {
    return { ...state, live: event.live }
  }
  const { live } = state
  if (!live) {
    return state
  }
  switch (event.type) {
    case 'thinking':
      return { ...state, live: { ...live, thinking: live.thinking + event.text } }
    case 'text':
      return { ...state, live: { ...live, text: live.text + event.text } }
    case 'file':
      return { ...state, live: { ...live, files: { ...live.files, [event.path]: event.name } } }
    case 'status':
      return { ...state, live: { ...live, status: event.status } }
    case 'task': {
      const { [event.toolUseId]: _previous, ...tasks } = live.tasks
      return { ...state, live: { ...live, tasks: event.progress ? { ...tasks, [event.toolUseId]: event.progress } : tasks } }
    }
  }
}

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
        if (event.type !== 'record') {
          setState((prev) => applyEvent(prev, event))
        } else if (event.index === count) {
          count += 1
          setState((prev) => ({ records: [...prev.records, event.record], live: applyRecord(prev.live, event.record) }))
        }
      },
    })
  }, [sessionId])

  return state
}

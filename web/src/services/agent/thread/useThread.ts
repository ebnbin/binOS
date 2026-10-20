import type { Item, Live, ThreadEvent } from '@binos/server/services/agent/types'
import { useEffect, useState } from 'react'
import { connectEventSource } from '../../../eventSource.ts'
import { threadStreamUrl } from '../api.ts'

// live 是回答进行中的临时内容，null 表示没在回答
export type ThreadContent = {
  items: Item[]
  live: Live | null
}

const initialContent: ThreadContent = { items: [], live: null }

// 记成条目的思考和文字取代对应的临时内容，和后端一致
function applyItem(live: Live | null, item: Item): Live | null {
  if (!live || ('parent' in item && item.parent)) {
    return live
  }
  if (item.type === 'text') {
    return { ...live, text: '', files: {} }
  }
  if (item.type === 'thinking') {
    return { ...live, thinking: '' }
  }
  return live
}

function applyEvent(content: ThreadContent, event: Exclude<ThreadEvent, { type: 'item' }>): ThreadContent {
  if (event.type === 'live') {
    return { ...content, live: event.live }
  }
  const { live } = content
  if (!live) {
    return content
  }
  switch (event.type) {
    case 'thinking':
      return { ...content, live: { ...live, thinking: live.thinking + event.text } }
    case 'text':
      return { ...content, live: { ...live, text: live.text + event.text } }
    case 'file':
      return { ...content, live: { ...live, files: { ...live.files, [event.path]: event.name } } }
    case 'status':
      return { ...content, live: { ...live, status: event.status } }
    case 'task': {
      const { [event.callId]: _previous, ...tasks } = live.tasks
      return { ...content, live: { ...live, tasks: event.progress ? { ...tasks, [event.callId]: event.progress } : tasks } }
    }
  }
}

// thread 的内容，随推送更新；thread 为 undefined 时是空的
export function useThread(thread: string | undefined): ThreadContent {
  const [content, setContent] = useState(initialContent)

  useEffect(() => {
    if (thread === undefined) {
      return
    }
    // 浏览器自己重连时用 Last-Event-ID 接着补发；由 connectEventSource 重连时从已收到的条数接着补发
    let count = 0
    return connectEventSource(() => threadStreamUrl(thread, count), {
      onMessage: (data) => {
        const event: ThreadEvent = JSON.parse(data)
        if (event.type !== 'item') {
          setContent((prev) => applyEvent(prev, event))
        } else if (event.index === count) {
          count += 1
          setContent((prev) => ({ items: [...prev.items, event.item], live: applyItem(prev.live, event.item) }))
        }
      },
    })
  }, [thread])

  return content
}

import type { Entry, Live, KitaSessionEvent } from '@binos/server/services/kita/types'
import { useEffect, useState } from 'react'
import { connectEventSource } from '../../../eventSource.ts'
import { sessionStreamUrl } from '../api.ts'

// live 是回答进行中的临时内容，null 表示没在回答
export type KitaSessionContent = {
  items: Entry[]
  live: Live | null
}

const initialContent: KitaSessionContent = { items: [], live: null }

// 记成条目的思考和文字取代对应的临时内容，和后端一致
function applyItem(live: Live | null, item: Entry): Live | null {
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

function applyEvent(live: Live | null, event: Exclude<KitaSessionEvent, { type: 'event' }>): Live | null {
  if (event.type === 'live') {
    return event.live
  }
  if (!live) {
    return live
  }
  switch (event.type) {
    case 'thinking':
      return { ...live, thinking: live.thinking + event.text }
    case 'text':
      return { ...live, text: live.text + event.text }
    case 'file':
      return { ...live, files: { ...live.files, [event.path]: event.name } }
    case 'status':
      return { ...live, status: event.status }
    case 'task': {
      const { [event.callId]: _previous, ...tasks } = live.tasks
      return { ...live, tasks: event.progress ? { ...tasks, [event.callId]: event.progress } : tasks }
    }
  }
}

function applyEvents(content: KitaSessionContent, events: KitaSessionEvent[]): KitaSessionContent {
  const added: Entry[] = []
  let { live } = content
  for (const event of events) {
    if (event.type === 'event') {
      added.push(event.event.data)
      live = applyItem(live, event.event.data)
    } else {
      live = applyEvent(live, event)
    }
  }
  return { items: added.length ? [...content.items, ...added] : content.items, live }
}

// thread 的内容，随推送更新；thread 为 undefined 时是空的
export function useKitaSession(thread: string | undefined): KitaSessionContent {
  const [content, setContent] = useState(initialContent)

  useEffect(() => {
    if (thread === undefined) {
      return
    }
    // 打开时补发的历史和回答中的文字都来得很密，攒到下一帧一起交给页面，一帧只重新渲染一次
    let queue: KitaSessionEvent[] = []
    let frame = 0
    const flush = () => {
      frame = 0
      const events = queue
      queue = []
      setContent((prev) => applyEvents(prev, events))
    }
    // 浏览器自己重连时用 Last-Event-ID 接着补发；由 connectEventSource 重连时从已收到的条数接着补发
    let count = 0
    const close = connectEventSource(() => sessionStreamUrl(thread, count), {
      onMessage: (data) => {
        const event: KitaSessionEvent = JSON.parse(data)
        if (event.type === 'event') {
          if (event.event.seq !== count + 1) {
            return
          }
          count += 1
        }
        queue.push(event)
        frame ||= requestAnimationFrame(flush)
      },
    })
    return () => {
      cancelAnimationFrame(frame)
      close()
    }
  }, [thread])

  return content
}

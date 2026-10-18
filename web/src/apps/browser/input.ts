import type { InputEvent } from '@binos/server/apps/browser/types'
import { sendInput } from './api.ts'

// 一次只发一批，上一批完成前到达的事件攒成下一批；连续的移动只保留最后一个，连续的滚动合并
export function createInputQueue() {
  let queue: InputEvent[] = []
  let sending = false
  const flush = async () => {
    if (sending || !queue.length) {
      return
    }
    sending = true
    const events = queue
    queue = []
    await sendInput(events)
    sending = false
    void flush()
  }
  return (event: InputEvent) => {
    const last = queue.at(-1)
    if (event.type === 'mouse' && event.action === 'move' && last?.type === 'mouse' && last.action === 'move') {
      queue[queue.length - 1] = event
    } else if (event.type === 'wheel' && last?.type === 'wheel') {
      queue[queue.length - 1] = { ...event, deltaX: last.deltaX + event.deltaX, deltaY: last.deltaY + event.deltaY }
    } else {
      queue.push(event)
    }
    void flush()
  }
}

export const modifiers = (event: { altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) =>
  (event.altKey ? 1 : 0) | (event.ctrlKey ? 2 : 0) | (event.metaKey ? 4 : 0) | (event.shiftKey ? 8 : 0)

export const mouseButton = (button: number): 'none' | 'left' | 'middle' | 'right' => (['left', 'middle', 'right'] as const)[button] ?? 'none'

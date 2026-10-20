import type { Live, LiveEvent, Status, TaskProgress } from '../types.js'
import type { DecodedItem } from './types.js'

// 工具结果里能显示的图片：媒体类型 → 存成文件的扩展名
export const imageExtensions: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' }

// 工具结果的文字只留末尾这么多：出错时要看的报错一般在最后
const outputLimit = 64 * 1024

export function truncatedOutput(text: string): { output?: string; truncated?: true } {
  const trimmed = text.trimEnd()
  return {
    ...(trimmed && { output: trimmed.slice(-outputLimit) }),
    ...(trimmed.length > outputLimit && { truncated: true as const }),
  }
}

// 各个解码器共用的临时内容：正在想的思考、正在写的文字、当前在做什么、子 agent 和后台任务的进展
export class LiveState {
  private live: Omit<Live, 'files'> = { thinking: '', text: '', status: null, tasks: {} }
  // 这一段思考开始的时间；后端重启时正在想的那段不知道
  thinkingStartedAt: number | undefined

  current(): Omit<Live, 'files'> {
    return this.live
  }

  get thinking() {
    return this.live.thinking
  }

  get text() {
    return this.live.text
  }

  status(value: Status | null, events: LiveEvent[]) {
    this.live.status = value
    events.push({ type: 'status', status: value })
  }

  appendThinking(delta: string, events: LiveEvent[]) {
    this.live.thinking += delta
    events.push({ type: 'thinking', text: delta })
  }

  appendText(delta: string, events: LiveEvent[]) {
    this.live.text += delta
    events.push({ type: 'text', text: delta })
  }

  // 思考、文字成了条目，对应的临时内容清空
  clearThinking() {
    this.live.thinking = ''
    this.thinkingStartedAt = undefined
  }

  clearText() {
    this.live.text = ''
  }

  task(callId: string, progress: TaskProgress | null, events: LiveEvent[]) {
    if (progress) {
      this.live.tasks[callId] = progress
    } else if (this.live.tasks[callId]) {
      delete this.live.tasks[callId]
    } else {
      return
    }
    events.push({ type: 'task', callId, progress })
  }

  // 被打断、停止或出错时还没想完的思考、还没写完的文字照样记下
  flush(time: string): DecodedItem[] {
    const items: DecodedItem[] = []
    if (this.live.thinking) {
      items.push({ type: 'thinking', time, text: this.live.thinking })
    }
    if (this.live.text) {
      items.push({ type: 'text', time, text: this.live.text })
    }
    this.clearThinking()
    this.clearText()
    return items
  }
}

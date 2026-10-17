// 前后端共用的数据类型：transcript 的条目，以及推给页面的实时事件

// 消息内容块，与 Claude 的 Messages API 一致：工具调用在 assistant 消息里，工具结果在 user 消息里
export type TextBlock = { type: 'text'; text: string }
// 图片是 session 的 files/ 里的文件，file 是文件名
export type ImageBlock = { type: 'image'; file: string }
export type ToolUseBlock = { type: 'tool_use'; id: string; name: string; input: unknown }
export type ToolResultBlock = {
  type: 'tool_result'
  tool_use_id: string
  content: (TextBlock | ImageBlock)[]
  is_error?: boolean
}
export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock

// transcript.jsonl 的每一行是一个条目，字段沿用 Claude Code 会话记录的命名，sessionId 是 binOS 的 session 编号。
// 用户发来的消息 content 是字符串，其余是内容块数组
export type Entry = {
  type: 'user' | 'assistant' | 'system'
  uuid: string
  parentUuid: string | null
  sessionId: number
  timestamp: string
  message?: {
    role: 'user' | 'assistant'
    content: string | ContentBlock[]
  }
  subtype?: string
  content?: string
}

export type EntryFields = Pick<Entry, 'type' | 'message' | 'subtype' | 'content'>

export type SessionSummary = {
  id: number
  // 第一条用户消息
  title: string
  // 最后一个条目的时间
  updatedAt: string | null
  // 是否有回答在进行
  running: boolean
}

// 推给页面的事件：新写入的条目（index 是它在 transcript 中的位置）、这一轮到目前为止的进展、是否有回答在进行
export type LiveEvent =
  | { type: 'entry'; index: number; entry: Entry }
  | { type: 'progress'; blocks: ContentBlock[] }
  | { type: 'status'; running: boolean }

// 停止时记录的内容，与 Claude Code 一致
export const interruptedText = '[Request interrupted by user]'

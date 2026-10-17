// 消息内容块，与 Claude 的 Messages API 一致：工具调用在 assistant 消息里，工具结果在 user 消息里
export type TextBlock = { type: 'text'; text: string }
// file 是 session 的 files/ 里的文件名
export type ImageBlock = { type: 'image'; file: string }
export type ToolUseBlock = { type: 'tool_use'; id: string; name: string; input: unknown }
export type ToolResultBlock = {
  type: 'tool_result'
  tool_use_id: string
  content: (TextBlock | ImageBlock)[]
  is_error?: boolean
}
export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock

// 用户发消息时附上的文件。file 是 session 的 files/ 里的文件名，name 是原来的文件名
export type Attachment = { file: string; name: string }

// transcript.jsonl 的每一行是一个条目，字段沿用 Claude Code 会话记录的命名，sessionId 是 binOS 的 session 编号。
// 用户发来的消息 content 是字符串，附件在 attachments 里；其余是内容块数组
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
  attachments?: Attachment[]
  subtype?: string
  content?: string
}

export type EntryFields = Pick<Entry, 'type' | 'message' | 'attachments' | 'subtype' | 'content'>

export type SessionSummary = {
  id: number
  // 第一条用户消息，没写字时是第一个附件的文件名
  title: string
  updatedAt: string | null
  running: boolean
}

// index 是条目在 transcript 中的位置
export type LiveEvent =
  | { type: 'entry'; index: number; entry: Entry }
  | { type: 'progress'; blocks: ContentBlock[] }
  | { type: 'status'; running: boolean }

// /api/events 推送的全局通知
export type ChangeEvent = { type: 'session'; id: number }

// 停止时记录的内容，与 Claude Code 一致
export const interruptedText = '[Request interrupted by user]'

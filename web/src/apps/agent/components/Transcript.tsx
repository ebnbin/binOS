import type { Attachment, Live, TranscriptRecord } from '@binos/server/apps/agent/types'
import { Alert } from './Alert.tsx'
import { AttachmentList } from './Attachments.tsx'
import { Markdown } from './Markdown.tsx'
import { ToolGroup } from './ToolCall.tsx'
import type { ToolCallItem, ToolResult, ToolUse } from './ToolCall.tsx'
import styles from './Transcript.module.css'

type Item =
  | { kind: 'user'; key: string; text: string }
  | { kind: 'text'; key: string; text: string; files?: Record<string, string> }
  | { kind: 'attachments'; key: string; attachments: Attachment[] }
  | { kind: 'stopped'; key: string }
  | { kind: 'alert'; key: string; text: string }
  | { kind: 'tools'; key: string; calls: ToolCallItem[] }

// 工具调用和它的结果是两条记录，按 id 对应起来；相邻的工具调用合成一组。子 agent 的记录不在这里显示
function buildItems(records: TranscriptRecord[], live: Live | null): Item[] {
  const results = new Map<string, ToolResult>()
  for (const record of records) {
    if (record.type === 'tool_result') {
      results.set(record.toolUseId, record)
    }
  }

  const items: Item[] = []
  const addTool = (use: ToolUse) => {
    const call = { use, result: results.get(use.id), live: live !== null }
    const last = items.at(-1)
    if (last?.kind === 'tools') {
      last.calls.push(call)
    } else {
      items.push({ kind: 'tools', key: use.id, calls: [call] })
    }
  }

  records.forEach((record, index) => {
    const key = String(index)
    if ('parent' in record && record.parent) {
      return
    }
    switch (record.type) {
      case 'user':
        if (record.attachments?.length) {
          items.push({ kind: 'attachments', key: `${key}-attachments`, attachments: record.attachments })
        }
        if (record.text.trim()) {
          items.push({ kind: 'user', key, text: record.text })
        }
        break
      case 'text':
        if (record.text.trim()) {
          items.push({ kind: 'text', key, text: record.text, files: record.files })
        }
        break
      case 'tool_use':
        addTool(record)
        break
      case 'result':
        if (record.outcome === 'stopped') {
          items.push({ kind: 'stopped', key })
        } else if (record.outcome === 'error') {
          items.push({ kind: 'alert', key, text: record.error ?? '' })
        }
        break
    }
  })
  if (live?.text.trim()) {
    items.push({ kind: 'text', key: 'live', text: live.text, files: live.files })
  }
  return items
}

export function Transcript({ sessionId, records, live }: { sessionId: number; records: TranscriptRecord[]; live: Live | null }) {
  return buildItems(records, live).map((item) => {
    switch (item.kind) {
      case 'user':
        return (
          <div key={item.key} className={styles.user}>
            {item.text}
          </div>
        )
      case 'text':
        return <Markdown key={item.key} sessionId={sessionId} text={item.text} files={item.files} />
      case 'attachments':
        return <AttachmentList key={item.key} sessionId={sessionId} attachments={item.attachments} />
      case 'stopped':
        return (
          <div key={item.key} className={styles.divider}>
            已停止
          </div>
        )
      case 'alert':
        return <Alert key={item.key}>{item.text}</Alert>
      case 'tools':
        return <ToolGroup key={item.key} sessionId={sessionId} calls={item.calls} />
    }
  })
}

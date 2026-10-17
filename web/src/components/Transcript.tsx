import { interruptedText } from '@binos/server/types'
import type { ContentBlock, Entry, ToolResultBlock, ToolUseBlock } from '@binos/server/types'
import { Alert } from './Alert.tsx'
import { Markdown } from './Markdown.tsx'
import { ToolGroup } from './ToolCall.tsx'
import type { ToolCallItem } from './ToolCall.tsx'
import styles from './Transcript.module.css'

type Item =
  | { kind: 'text'; key: string; role: 'user' | 'assistant'; text: string }
  | { kind: 'stopped'; key: string }
  | { kind: 'alert'; key: string; text: string }
  | { kind: 'tools'; key: string; calls: ToolCallItem[] }

function blocksOf(entry: Entry): ContentBlock[] {
  const content = entry.message?.content
  return typeof content === 'string' ? [{ type: 'text', text: content }] : (content ?? [])
}

// 工具调用和它的结果在不同的条目里，按 id 对应起来；相邻的工具调用合成一组
function buildItems(entries: Entry[], progress: ContentBlock[] | null): Item[] {
  const results = new Map<string, ToolResultBlock>()
  for (const block of [...entries.flatMap(blocksOf), ...(progress ?? [])]) {
    if (block.type === 'tool_result') {
      results.set(block.tool_use_id, block)
    }
  }

  const items: Item[] = []
  const addTool = (use: ToolUseBlock, live: boolean) => {
    const call = { use, result: results.get(use.id), live }
    const last = items.at(-1)
    if (last?.kind === 'tools') {
      last.calls.push(call)
    } else {
      items.push({ kind: 'tools', key: use.id, calls: [call] })
    }
  }
  const addBlock = (block: ContentBlock, key: string, role: 'user' | 'assistant', live: boolean) => {
    if (block.type === 'tool_use') {
      addTool(block, live)
    } else if (block.type === 'text' && block.text === interruptedText) {
      items.push({ kind: 'stopped', key })
    } else if (block.type === 'text' && block.text.trim()) {
      items.push({ kind: 'text', key, role, text: block.text })
    }
  }

  for (const entry of entries) {
    if (entry.type === 'system') {
      items.push({ kind: 'alert', key: entry.uuid, text: entry.content ?? '' })
    } else {
      blocksOf(entry).forEach((block, i) => addBlock(block, `${entry.uuid}-${i}`, entry.type as 'user' | 'assistant', false))
    }
  }
  progress?.forEach((block, i) => addBlock(block, `progress-${i}`, 'assistant', true))
  return items
}

export function Transcript({
  sessionId,
  entries,
  progress,
}: {
  sessionId: number
  entries: Entry[]
  progress: ContentBlock[] | null
}) {
  return buildItems(entries, progress).map((item) => {
    switch (item.kind) {
      case 'text':
        return item.role === 'user' ? (
          <div key={item.key} className={styles.user}>
            {item.text}
          </div>
        ) : (
          <Markdown key={item.key} sessionId={sessionId} text={item.text} />
        )
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

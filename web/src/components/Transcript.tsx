import { interruptedText } from '@binos/server/types'
import type { ContentBlock, Entry, ToolResultBlock } from '@binos/server/types'
import { ToolCall } from './ToolCall.tsx'

function blocksOf(entry: Entry): ContentBlock[] {
  const content = entry.message?.content
  return typeof content === 'string' ? [{ type: 'text', text: content }] : (content ?? [])
}

// 工具调用和它的结果在不同的条目里，按 id 对应起来
export function Transcript({
  sessionId,
  entries,
  progress,
}: {
  sessionId: number
  entries: Entry[]
  progress: ContentBlock[] | null
}) {
  const results = new Map<string, ToolResultBlock>()
  for (const block of [...entries.flatMap(blocksOf), ...(progress ?? [])]) {
    if (block.type === 'tool_result') {
      results.set(block.tool_use_id, block)
    }
  }

  const renderBlock = (block: ContentBlock, key: string, role: string, live: boolean) => {
    if (block.type === 'tool_use') {
      return <ToolCall key={key} sessionId={sessionId} use={block} result={results.get(block.id)} live={live} />
    }
    if (block.type === 'text' && block.text === interruptedText) {
      return <div key={key} className="notice">已停止</div>
    }
    if (block.type === 'text') {
      return <div key={key} className={`message ${role}`}>{block.text}</div>
    }
    return null
  }

  return (
    <>
      {entries.map((entry) =>
        entry.type === 'system' ? (
          <div key={entry.uuid} className="message system">{entry.content}</div>
        ) : (
          blocksOf(entry).map((block, i) => renderBlock(block, `${entry.uuid}-${i}`, entry.type, false))
        ),
      )}
      {progress?.map((block, i) => renderBlock(block, `progress-${i}`, 'assistant', true))}
    </>
  )
}

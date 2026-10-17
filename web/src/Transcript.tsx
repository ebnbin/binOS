// 与后端 transcript.jsonl 的条目一致：工具调用在 assistant 条目里，工具结果在 user 条目里
type TextBlock = { type: 'text'; text: string }
// 图片是 session 里保存的文件
type ImageBlock = { type: 'image'; file: string }
export type Block =
  | TextBlock
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: (TextBlock | ImageBlock)[]; is_error?: boolean }

export type Entry = {
  type: 'user' | 'assistant' | 'system'
  uuid: string
  message?: { role: string; content: string | Block[] }
  content?: string
}

type ToolUse = Extract<Block, { type: 'tool_use' }>
type ToolResult = Extract<Block, { type: 'tool_result' }>

const interruptedText = '[Request interrupted by user]'
const outputLimit = 4000

// 已写入的条目，加上正在进行的这一轮的进展
export function Transcript({ sessionId, entries, progress }: { sessionId: number; entries: Entry[]; progress: Block[] | null }) {
  const blocksOf = (entry: Entry): Block[] => {
    const content = entry.message?.content
    return typeof content === 'string' ? [{ type: 'text', text: content }] : (content ?? [])
  }
  const results = new Map<string, ToolResult>()
  for (const block of [...entries.flatMap(blocksOf), ...(progress ?? [])]) {
    if (block.type === 'tool_result') {
      results.set(block.tool_use_id, block)
    }
  }

  const renderBlock = (block: Block, key: string, role: string, live: boolean) => {
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

function ToolCall({ sessionId, use, result, live }: { sessionId: number; use: ToolUse; result?: ToolResult; live: boolean }) {
  const status = result ? (result.is_error ? 'error' : 'done') : live ? 'running' : 'stopped'
  const icon = { running: '…', done: '✓', error: '✗', stopped: '–' }[status]
  const input = use.input as Record<string, unknown>
  return (
    <details className={`tool ${status}`}>
      <summary>
        <span className="tool-icon">{icon}</span>
        <span className="tool-name">{use.name}</span>
        <span className="tool-summary">{toolSummary(use.name, input)}</span>
      </summary>
      <pre>{use.name === 'Bash' ? String(input.command ?? '') : JSON.stringify(input, null, 2)}</pre>
      {result?.content.map((part, i) => {
        if (part.type === 'text') {
          return <pre key={i} className="tool-output">{truncate(part.text)}</pre>
        }
        const src = `/api/sessions/${sessionId}/images/${part.file}`
        return (
          <a key={i} className="tool-image" href={src} target="_blank" rel="noreferrer">
            <img src={src} alt="" />
          </a>
        )
      })}
    </details>
  )
}

// 一行说明这次调用做了什么：命令、文件路径、搜索内容等
function toolSummary(name: string, input: Record<string, unknown>): string {
  const key = { Bash: 'command', Read: 'file_path', Write: 'file_path', Edit: 'file_path', Grep: 'pattern', Glob: 'pattern', WebFetch: 'url', WebSearch: 'query' }[name]
  const value = key ? input[key] : Object.values(input).find((v) => typeof v === 'string')
  return typeof value === 'string' ? value : ''
}

function truncate(text: string) {
  return text.length > outputLimit ? `${text.slice(0, outputLimit)}\n…（还有 ${text.length - outputLimit} 个字符）` : text
}

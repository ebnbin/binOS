import type { ToolResultBlock, ToolUseBlock } from '@binos/server/types'
import { fileUrl } from '../api.ts'

const outputLimit = 4000
const statusIcons = { running: '…', done: '✓', error: '✗', stopped: '–' }

export function ToolCall({
  sessionId,
  use,
  result,
  live,
}: {
  sessionId: number
  use: ToolUseBlock
  result: ToolResultBlock | undefined
  live: boolean
}) {
  const status = result ? (result.is_error ? 'error' : 'done') : live ? 'running' : 'stopped'
  const input = use.input as Record<string, unknown>
  return (
    <details className={`tool ${status}`}>
      <summary>
        <span className="tool-icon">{statusIcons[status]}</span>
        <span className="tool-name">{use.name}</span>
        <span className="tool-summary">{toolSummary(use.name, input)}</span>
      </summary>
      <pre>{use.name === 'Bash' ? String(input.command ?? '') : JSON.stringify(input, null, 2)}</pre>
      {result?.content.map((part, i) => {
        if (part.type === 'text') {
          return <pre key={i} className="tool-output">{truncate(part.text)}</pre>
        }
        const src = fileUrl(sessionId, part.file)
        return (
          <a key={i} className="tool-image" href={src} target="_blank" rel="noreferrer">
            <img src={src} alt="" />
          </a>
        )
      })}
    </details>
  )
}

const summaryKeys: Record<string, string> = {
  Bash: 'command',
  Read: 'file_path',
  Write: 'file_path',
  Edit: 'file_path',
  Grep: 'pattern',
  Glob: 'pattern',
  WebFetch: 'url',
  WebSearch: 'query',
}

function toolSummary(name: string, input: Record<string, unknown>): string {
  const key = summaryKeys[name]
  const value = key ? input[key] : Object.values(input).find((v) => typeof v === 'string')
  return typeof value === 'string' ? value : ''
}

function truncate(text: string) {
  return text.length > outputLimit ? `${text.slice(0, outputLimit)}\n…（还有 ${text.length - outputLimit} 个字符）` : text
}

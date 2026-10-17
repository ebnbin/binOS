import type { ToolResultBlock, ToolUseBlock } from '@binos/server/types'
import { Check, ChevronRight, Minus, X } from 'lucide-react'
import { fileUrl } from '../api.ts'
import styles from './ToolCall.module.css'
import { Spinner } from './ui/Spinner.tsx'

export type ToolCallItem = { use: ToolUseBlock; result: ToolResultBlock | undefined; live: boolean }

const outputLimit = 4000

export function ToolGroup({ sessionId, calls }: { sessionId: number; calls: ToolCallItem[] }) {
  return (
    <div className={styles.group}>
      {calls.map((call) => (
        <ToolCall key={call.use.id} sessionId={sessionId} {...call} />
      ))}
    </div>
  )
}

function ToolCall({ sessionId, use, result, live }: { sessionId: number } & ToolCallItem) {
  const status = result ? (result.is_error ? 'error' : 'done') : live ? 'running' : 'stopped'
  const input = use.input as Record<string, unknown>
  return (
    <details className={styles.call} data-status={status}>
      <summary className={styles.row}>
        <span className={styles.status}>
          <StatusIcon status={status} />
        </span>
        <span className={styles.name}>{use.name}</span>
        <span className={styles.summary}>{toolSummary(use.name, input)}</span>
        <ChevronRight size={15} strokeWidth={1.75} className={styles.chevron} />
      </summary>
      <div className={styles.body}>
        <pre className={styles.pre}>{use.name === 'Bash' ? String(input.command ?? '') : JSON.stringify(input, null, 2)}</pre>
        {result?.content.map((part, i) => {
          if (part.type === 'text') {
            return (
              <pre key={i} className={`${styles.pre} ${styles.output}`}>
                {truncate(part.text)}
              </pre>
            )
          }
          const src = fileUrl(sessionId, part.file)
          return (
            <a key={i} className={styles.image} href={src} target="_blank" rel="noreferrer">
              <img src={src} alt="" />
            </a>
          )
        })}
      </div>
    </details>
  )
}

function StatusIcon({ status }: { status: 'running' | 'done' | 'error' | 'stopped' }) {
  switch (status) {
    case 'running':
      return <Spinner />
    case 'done':
      return <Check size={14} strokeWidth={2.2} aria-label="完成" />
    case 'error':
      return <X size={14} strokeWidth={2.2} aria-label="出错" />
    case 'stopped':
      return <Minus size={14} strokeWidth={2.2} aria-label="已停止" />
  }
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

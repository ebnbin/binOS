import type { TranscriptRecord } from '@binos/server/apps/agent/types'
import { Check, ChevronRight, Minus, X } from 'lucide-react'
import { fileUrl } from '../api.ts'
import styles from './ToolCall.module.css'
import { Spinner } from '../../../ui/Spinner.tsx'

export type ToolUse = Extract<TranscriptRecord, { type: 'tool_use' }>
export type ToolResult = Extract<TranscriptRecord, { type: 'tool_result' }>
// live：这一轮还在回答，没有结果的调用还在运行
export type ToolCallItem = { use: ToolUse; result: ToolResult | undefined; live: boolean }

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
  const status = result ? result.status : live ? 'running' : 'stopped'
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
        {result?.output && (
          <pre className={`${styles.pre} ${styles.output}`}>
            {result.truncated ? `…（前面的输出已省略）\n${result.output}` : result.output}
          </pre>
        )}
        {result?.images?.map((file) => (
          <a key={file} className={styles.image} href={fileUrl(sessionId, file)} target="_blank" rel="noreferrer">
            <img src={fileUrl(sessionId, file)} alt="" />
          </a>
        ))}
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

import { Check, ChevronRight, Minus, X } from 'lucide-react'
import { fileUrl } from '../api.ts'
import { formatDuration } from '../format.ts'
import { callDuration, callStatus } from '../tool-calls.ts'
import type { CallStatus, ToolCallItem } from '../tool-calls.ts'
import styles from './ToolCall.module.css'
import { Spinner } from '../../../ui/Spinner.tsx'

export function ToolGroup({ sessionId, calls, now }: { sessionId: number; calls: ToolCallItem[]; now: number }) {
  return (
    <div className={styles.group}>
      {calls.map((call) => (
        <ToolCall key={call.use.id} sessionId={sessionId} call={call} now={now} />
      ))}
    </div>
  )
}

function ToolCall({ sessionId, call, now }: { sessionId: number; call: ToolCallItem; now: number }) {
  const { use, result } = call
  const status = callStatus(call)
  const duration = callDuration(call, now)
  const input = use.input as Record<string, unknown>
  return (
    <details className={styles.call} data-status={status}>
      <summary className={styles.row}>
        <span className={styles.status}>
          <StatusIcon status={status} />
        </span>
        <span className={styles.name}>{use.name}</span>
        <span className={styles.summary}>{toolSummary(use.name, input)}</span>
        {use.background && <span className={styles.badge}>后台</span>}
        {duration !== undefined && <span className={styles.time}>{formatDuration(duration)}</span>}
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

export function StatusIcon({ status }: { status: CallStatus }) {
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

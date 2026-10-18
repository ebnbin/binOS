import { Check, ChevronRight, Minus, X } from 'lucide-react'
import { useState } from 'react'
import { formatDuration } from '../format.ts'
import { callDuration, callStatus } from '../tool-calls.ts'
import type { CallStatus, ToolCallItem } from '../tool-calls.ts'
import { ToolBody } from './ToolBody.tsx'
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
  // 展开时才渲染内容：一个会话里有上百次调用，不展开的不用高亮
  const [open, setOpen] = useState(false)
  return (
    <details className={styles.call} data-status={status} onToggle={(event) => setOpen(event.currentTarget.open)}>
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
      {open && (
        <div className={styles.body}>
          <ToolBody sessionId={sessionId} use={use} result={result} />
        </div>
      )}
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

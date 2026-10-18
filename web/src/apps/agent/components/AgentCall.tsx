import type { TaskProgress } from '@binos/server/apps/agent/types'
import { Bot, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatDuration, formatTokens } from '../format.ts'
import styles from './AgentCall.module.css'
import { Markdown } from './Markdown.tsx'
import { callDuration, callStatus } from '../tool-calls.ts'
import type { ToolCallItem } from '../tool-calls.ts'
import { StatusIcon } from './ToolCall.tsx'

// 子 agent：卡片上是任务描述和正在做的一步，展开是它自己的过程（timeline）。
// 过程里已经有它最后的回复；没有过程的记录时（这个格式之前的会话）显示它交回的结果
export function AgentCall({
  sessionId,
  call,
  progress,
  now,
  timeline,
}: {
  sessionId: number
  call: ToolCallItem
  progress: TaskProgress | undefined
  now: number
  timeline: ReactNode | undefined
}) {
  const { use, result } = call
  const input = use.input as { description?: unknown; subagent_type?: unknown; prompt?: unknown }
  const status = callStatus(call)
  const duration = callDuration(call, now)
  const details = progress && [
    progress.activity,
    progress.toolUses !== undefined && `${progress.toolUses} 次工具`,
    progress.tokens !== undefined && `${formatTokens(progress.tokens)} token`,
  ]
  return (
    <details className={styles.card} data-status={status}>
      <summary className={styles.header}>
        <span className={styles.row}>
          <span className={styles.status}>
            <StatusIcon status={status} />
          </span>
          <Bot size={15} strokeWidth={1.75} className={styles.icon} />
          <span className={styles.title}>{typeof input.description === 'string' && input.description ? input.description : '子 agent'}</span>
          {typeof input.subagent_type === 'string' && <span className={styles.badge}>{input.subagent_type}</span>}
          {use.background && <span className={styles.badge}>后台</span>}
          {duration !== undefined && <span className={styles.time}>{formatDuration(duration)}</span>}
          <ChevronRight size={15} strokeWidth={1.75} className={styles.chevron} />
        </span>
        {status === 'running' && details && <span className={styles.activity}>{details.filter(Boolean).join(' · ')}</span>}
      </summary>
      <div className={styles.body}>
        {typeof input.prompt === 'string' && (
          <details className={styles.prompt}>
            <summary>任务说明</summary>
            <pre>{input.prompt}</pre>
          </details>
        )}
        {timeline}
        {!timeline && result?.output && (
          <div className={styles.result}>
            <Markdown sessionId={sessionId} text={result.output} />
          </div>
        )}
      </div>
    </details>
  )
}

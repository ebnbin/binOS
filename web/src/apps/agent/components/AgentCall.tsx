import type { TaskProgress } from '@binos/server/apps/agent/types'
import { Bot, ScrollText } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatDuration, formatTokens } from '../format.ts'
import { callDuration, callStatus } from '../tool-calls.ts'
import type { ToolCallItem } from '../tool-calls.ts'
import { Activity } from './Activity.tsx'
import styles from './AgentCall.module.css'
import { Markdown } from './Markdown.tsx'

// 子 agent：一行是任务描述，运行中带上正在做的一步；展开是任务说明和它自己的过程（timeline）。
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
  const description = typeof input.description === 'string' ? input.description : ''
  const type = typeof input.subagent_type === 'string' ? input.subagent_type : undefined
  const running = status === 'running' && progress
  const meta = [
    use.background && '后台',
    running && progress.toolUses !== undefined && `${progress.toolUses} 次工具`,
    running && progress.tokens !== undefined && `${formatTokens(progress.tokens)} token`,
    duration !== undefined && formatDuration(duration),
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <Activity
      icon={<Bot size={14} strokeWidth={1.75} />}
      label={type ? `子 agent（${type}）` : '子 agent'}
      detail={running && progress.activity ? `${description} · ${progress.activity}` : description}
      meta={meta}
      status={status}
      body={() => (
        <>
          {typeof input.prompt === 'string' && (
            <Activity
              icon={<ScrollText size={14} strokeWidth={1.75} />}
              label="任务说明"
              body={() => <pre className={styles.prompt}>{input.prompt as string}</pre>}
            />
          )}
          {timeline}
          {!timeline && result?.output && <Markdown sessionId={sessionId} text={result.output} />}
        </>
      )}
    />
  )
}

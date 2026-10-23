import { agents, agentIds } from '@binos/server/services/kita/types'
import type { Limits, AgentId } from '@binos/server/services/kita/types'
import { Button, Heading, Separator } from '@radix-ui/themes'
import { Fragment } from 'react'
import { Popover } from '../../../ui/Popover.tsx'
import { formatSpan, summary, useMinuteNow } from '../../../services/kita/quota.ts'
import { useAgentStatus } from '../../../services/kita/status.ts'
import { QuotaRing } from '../../../services/kita/QuotaRing.tsx'
import { QuotaWindows } from '../../../services/kita/QuotaWindows.tsx'
import styles from './Quota.module.css'

// 订阅额度：每个报告过额度的 agent 一个同心双环（外圈 7 天、内圈 5 小时），旁边是最紧的窗口用了多少；
// 被限流、或者按现在的速度会在重置前用完时变红。点开看每个窗口的详情
export function Quota() {
  const status = useAgentStatus()
  const now = useMinuteNow()
  const reported = agentIds.flatMap((agent): [AgentId, Limits][] => {
    const limits = status?.limits[agent]
    return limits ? [[agent, limits]] : []
  })
  if (reported.length === 0) {
    return null
  }
  return (
    <Popover
      label="订阅额度"
      className={styles.details}
      trigger={
        <Button type="button" size="1" variant="soft" color="gray" radius="full" title="订阅额度" aria-label="订阅额度">
          {reported.map(([agent, limits]) => {
            const { used, runsOut, limited } = summary(limits, now)
            return (
              <span
                key={agent}
                className={styles.agent}
                data-alert={limited || runsOut !== undefined || undefined}
                title={runsOut !== undefined && !limited ? `按现在的速度 ${formatSpan(runsOut)}后用完` : undefined}
              >
                <QuotaRing limits={limits} now={now} />
                {reported.length > 1 && `${agents[agent].name} `}
                {limited ? '已限流' : `${Math.round(used * 100)}%`}
              </span>
            )
          })}
        </Button>
      }
    >
      {reported.map(([agent, limits], index) => (
        <Fragment key={agent}>
          {index > 0 && <Separator size="4" />}
          <section>
            <Heading as="h3" size="2" className={styles.heading}>
              {agents[agent].name}
            </Heading>
            <QuotaWindows limits={limits} now={now} />
          </section>
        </Fragment>
      ))}
    </Popover>
  )
}

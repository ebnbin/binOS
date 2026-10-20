import { agents, providers } from '@binos/server/services/agent/types'
import type { Limits, Provider } from '@binos/server/services/agent/types'
import { useEffect, useRef, useState } from 'react'
import { formatSpan, summary, useMinuteNow } from '../../../services/agent/quota.ts'
import { useAgentStatus } from '../../../services/agent/status.ts'
import { QuotaRing } from '../../../services/agent/QuotaRing.tsx'
import { QuotaWindows } from '../../../services/agent/QuotaWindows.tsx'
import styles from './Quota.module.css'

// 订阅额度：每个报告过额度的 agent 一个同心双环（外圈 7 天、内圈 5 小时），旁边是最紧的窗口用了多少；
// 被限流、或者按现在的速度会在重置前用完时变红。点开看每个窗口的详情
export function Quota() {
  const status = useAgentStatus()
  const now = useMinuteNow()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  // 点外面关上
  useEffect(() => {
    if (!open) {
      return
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])
  const reported = providers.flatMap((provider): [Provider, Limits][] => {
    const limits = status?.limits[provider]
    return limits ? [[provider, limits]] : []
  })
  if (reported.length === 0) {
    return null
  }
  return (
    <div ref={ref} className={styles.quota}>
      <button type="button" className={styles.summary} onClick={() => setOpen(!open)} aria-expanded={open} title="订阅额度">
        {reported.map(([provider, limits]) => {
          const { used, runsOut, limited } = summary(limits, now)
          return (
            <span
              key={provider}
              className={styles.agent}
              data-alert={limited || runsOut !== undefined || undefined}
              title={runsOut !== undefined && !limited ? `按现在的速度 ${formatSpan(runsOut)}后用完` : undefined}
            >
              <QuotaRing limits={limits} now={now} />
              {reported.length > 1 && `${agents[provider].name} `}
              {limited ? '已限流' : `${Math.round(used * 100)}%`}
            </span>
          )
        })}
      </button>
      {open && (
        <div className={styles.details}>
          {reported.map(([provider, limits]) => (
            <section key={provider}>
              <h3>{agents[provider].name}</h3>
              <QuotaWindows limits={limits} now={now} />
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

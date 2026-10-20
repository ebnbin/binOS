import type { Limits } from '@binos/server/services/agent/types'
import { windowsOf, windowState } from './quota.ts'
import styles from './Quota.module.css'

// 同心双环：外圈 7 天、内圈 5 小时，弧长是用了多少，快满了变红
export function QuotaRing({ limits, now, size = 16 }: { limits: Limits; now: number; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={styles.ring} aria-hidden>
      {windowsOf(limits).map(({ key, window, length }) => {
        const { used } = windowState(window, length, now)
        const radius = key === 'fiveHour' ? 5.5 : 9.75
        const circumference = 2 * Math.PI * radius
        return (
          <g key={key} data-window={key} data-full={used >= 0.95 || undefined}>
            <circle cx="12" cy="12" r={radius} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
            <circle
              cx="12"
              cy="12"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - used)}
            />
          </g>
        )
      })}
    </svg>
  )
}

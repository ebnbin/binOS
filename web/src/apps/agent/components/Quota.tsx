import { limitsKey } from '@binos/server/apps/agent/types'
import type { Limits, QuotaWindow } from '@binos/server/apps/agent/types'
import { useEffect, useRef, useState } from 'react'
import { useStateValue } from '../../../state.ts'
import styles from './Quota.module.css'

const weekday = new Intl.DateTimeFormat('zh-CN', { weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

function formatReset(resetsAt: number) {
  const minutes = Math.round((resetsAt * 1000 - Date.now()) / 60_000)
  if (minutes <= 0) {
    return '已重置'
  }
  if (minutes < 60) {
    return `${minutes} 分钟后重置`
  }
  if (minutes < 24 * 60) {
    return `${Math.round(minutes / 60)} 小时后重置`
  }
  return `${weekday.format(new Date(resetsAt * 1000))} 重置`
}

// 过了重置时间，报告的用量就不作数了
const current = (window: QuotaWindow | undefined) => (window && window.resetsAt * 1000 > Date.now() ? window.utilization : 0)

function level(utilization: number, limited: boolean) {
  return limited || utilization >= 0.95 ? 'danger' : utilization >= 0.8 ? 'warning' : undefined
}

// 订阅额度：平时只显示两个窗口用了多少，点开看进度和重置时间
export function Quota() {
  const limits = useStateValue(limitsKey) as Limits | null
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
  if (!limits) {
    return null
  }
  const limited = limits.status !== 'allowed'
  const windows = [
    { name: '5 小时', window: limits.fiveHour },
    { name: '7 天', window: limits.sevenDay },
  ].filter((item) => item.window)
  return (
    <div ref={ref} className={styles.quota}>
      <button type="button" className={styles.summary} onClick={() => setOpen(!open)} aria-expanded={open} title="订阅额度">
        {limited
          ? '已限流'
          : windows.map(({ name, window }) => (
              <span key={name} data-level={level(current(window), false)}>
                {name} {Math.round(current(window) * 100)}%
              </span>
            ))}
      </button>
      {open && (
        <div className={styles.details}>
          {windows.map(({ name, window }) => (
            <div key={name} className={styles.row}>
              <div className={styles.label}>
                <span>{name}额度</span>
                <span>{Math.round(current(window) * 100)}%</span>
              </div>
              <div className={styles.bar} data-level={level(current(window), limited)}>
                <span style={{ width: `${Math.min(current(window), 1) * 100}%` }} />
              </div>
              <div className={styles.reset}>{formatReset(window!.resetsAt)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

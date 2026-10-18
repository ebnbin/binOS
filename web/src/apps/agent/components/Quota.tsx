import { limitsKeys } from '@binos/server/apps/agent/types'
import type { Limits, Provider } from '@binos/server/apps/agent/types'
import { useEffect, useRef, useState } from 'react'
import { useStateValue } from '../../../state.ts'
import { current, formatReset, level, windowsOf } from '../quota.ts'
import { providerNames } from '../providers.ts'
import styles from './Quota.module.css'

// 订阅额度：平时只显示用了多少，点开看进度和重置时间。
// 只有一个 agent 报告过额度时显示它两个窗口各用了多少；两个都有时各显示用得多的那个窗口
export function Quota() {
  const claude = useStateValue(limitsKeys.claude) as Limits | null
  const codex = useStateValue(limitsKeys.codex) as Limits | null
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
  const reported = (
    [
      ['claude', claude],
      ['codex', codex],
    ] as const
  ).filter((item): item is readonly [Provider, Limits] => item[1] !== null)
  if (reported.length === 0) {
    return null
  }
  return (
    <div ref={ref} className={styles.quota}>
      <button type="button" className={styles.summary} onClick={() => setOpen(!open)} aria-expanded={open} title="订阅额度">
        {reported.length === 1 ? (
          reported[0][1].status !== 'allowed' ? (
            '已限流'
          ) : (
            windowsOf(reported[0][1]).map(({ name, window }) => (
              <span key={name} data-level={level(current(window), false)}>
                {name} {Math.round(current(window) * 100)}%
              </span>
            ))
          )
        ) : (
          reported.map(([provider, limits]) => {
            const used = Math.max(0, ...windowsOf(limits).map(({ window }) => current(window)))
            const limited = limits.status !== 'allowed'
            return (
              <span key={provider} data-level={level(used, limited)}>
                {providerNames[provider]} {limited ? '已限流' : `${Math.round(used * 100)}%`}
              </span>
            )
          })
        )}
      </button>
      {open && (
        <div className={styles.details}>
          {reported.map(([provider, limits]) =>
            windowsOf(limits).map(({ name, window }) => (
              <div key={`${provider}-${name}`} className={styles.row}>
                <div className={styles.label}>
                  <span>
                    {reported.length > 1 && `${providerNames[provider]} `}
                    {name}额度
                  </span>
                  <span>{Math.round(current(window) * 100)}%</span>
                </div>
                <div className={styles.bar} data-level={level(current(window), limits.status !== 'allowed')}>
                  <span style={{ width: `${Math.min(current(window), 1) * 100}%` }} />
                </div>
                <div className={styles.reset}>{formatReset(window.resetsAt)}</div>
              </div>
            )),
          )}
        </div>
      )}
    </div>
  )
}

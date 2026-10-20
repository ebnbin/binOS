import { useEffect, useState } from 'react'
import { useConnected } from '../../events.ts'
import type { WidgetProps } from '../types.ts'
import { useMonitor } from './monitor.ts'
import styles from './SystemWidget.module.css'

const time = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const date = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })

function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 10_000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

// 时间、日期和系统状态
export function SystemWidget({ size, open }: WidgetProps) {
  const now = useNow()
  const connected = useConnected()
  const { status, error, now: sampledNow } = useMonitor()
  const snapshot = status?.snapshot
  const version = snapshot?.runtime.version
  const fresh = snapshot && sampledNow - snapshot.at < 30_000 && !error && !status?.collectionError

  return (
    <button
      type="button"
      className={styles.widget}
      data-size={size}
      onClick={(event) => {
        event.stopPropagation()
        open('/')
      }}
      title="打开宿主监控"
    >
      <span className={styles.time}>{time.format(now)}</span>
      <span className={styles.date}>{date.format(now)}</span>
      {snapshot && size !== '2x2' && (
        <span className={styles.metrics}>
          CPU {snapshot.cpu.percent?.toFixed(0) ?? '…'}% · 内存压力{' '}
          {snapshot.memory.pressure === 'normal' ? '正常' : snapshot.memory.pressure === 'unknown' ? '未知' : '偏高'}
        </span>
      )}
      <span className={styles.status}>
        <span className={styles.dot} data-connected={!!fresh && connected} />
        {!fresh ? '状态待更新' : '已连接'}
        {version && <span className={styles.version}>{version.slice(0, 7)}</span>}
      </span>
    </button>
  )
}

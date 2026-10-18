import { useEffect, useState } from 'react'
import { getVersion } from '../../api.ts'
import { useConnected } from '../../events.ts'
import type { WidgetProps } from '../types.ts'
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
export function SystemWidget({ size }: WidgetProps) {
  const now = useNow()
  const connected = useConnected()
  const [version, setVersion] = useState<string>()

  useEffect(() => {
    void getVersion().then(setVersion)
  }, [connected])

  return (
    <div className={styles.widget} data-size={size}>
      <span className={styles.time}>{time.format(now)}</span>
      <span className={styles.date}>{date.format(now)}</span>
      <span className={styles.status}>
        <span className={styles.dot} data-connected={connected} />
        {connected ? '已连接' : '已断开'}
        {version && <span className={styles.version}>{version.slice(0, 7)}</span>}
      </span>
    </div>
  )
}

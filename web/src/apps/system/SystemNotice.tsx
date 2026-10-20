import { TriangleAlert } from 'lucide-react'
import { useMonitor } from './monitor.ts'
import styles from './Monitor.module.css'

export function SystemNotice({ onOpen }: { onOpen(): void }) {
  const { status, error, now, lastSuccess } = useMonitor()
  const alerts = status?.alerts.filter((item) => !item.acknowledged) || []
  const stale = status?.snapshot && now - status.snapshot.at > 30_000
  const offline = error && (!lastSuccess || now - lastSuccess > 30_000)
  if (!alerts.length && !stale && !offline && !status?.collectionError) return null
  return (
    <button className={styles.notice} onClick={onOpen} title="打开系统监控" aria-label="系统监控告警">
      <TriangleAlert size={16} />
      {offline ? '监控连接异常' : stale ? '监控数据已过期' : status?.collectionError ? '宿主采集异常' : `${alerts.length} 项系统事件待阅`}
    </button>
  )
}

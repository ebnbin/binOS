import type { MonitorStatus } from '@binos/server/apps/system/types'
import { Cpu, Data, MemoryStick, SpeedFast, Zap } from '../../ui/icons.tsx'
import type { Icon } from '../../ui/icons.tsx'
import { InlineAlert } from '../../ui/InlineAlert.tsx'
import { ProgressBar } from '../../ui/ProgressBar.tsx'
import { StatusLight } from '../../ui/StatusLight.tsx'
import type { ReactNode } from 'react'
import { bytes } from './format.ts'
import styles from './Monitor.module.css'

const pressureNames = { normal: '正常', warning: '偏高', critical: '很高', unknown: '未知' }
const pressureVariants = { normal: 'positive', warning: 'notice', critical: 'negative', unknown: 'neutral' } as const

// meter 的颜色随占用升高从 informative 变成 notice、negative
const meterVariant = (percent: number) => (percent >= 90 ? 'negative' : percent >= 75 ? 'notice' : 'informative')
const percentOf = (part: number, total: number) => (total > 0 ? (part / total) * 100 : 0)

export function HostMonitor({ status }: { status: MonitorStatus }) {
  const s = status.snapshot
  if (!s) return <p className={styles.empty}>正在读取 Mac 状态…</p>
  const usedMemory = s.memory.cached === null ? null : Math.max(0, s.memory.total - s.memory.free - s.memory.cached)
  const cpu = s.cpu.percent
  const uptime = s.host.uptime
  const memoryPercent = usedMemory === null ? 0 : percentOf(usedMemory, s.memory.total)
  return (
    <div className={styles.content}>
      <header className={styles.hero}>
        <h2 className={styles.heroTitle}>{s.host.name}</h2>
        <p>
          {s.host.chip} · {s.host.cores} 核 · {s.host.os}
        </p>
      </header>
      {s.unavailable.length > 0 && (
        <InlineAlert variant="informative" className={styles.inlineAlert}>
          {s.unavailable.join('、')}暂时无法读取，其他信息仍会更新。
        </InlineAlert>
      )}
      <div className={styles.cards}>
        <Card icon={Cpu} title="CPU">
          <strong className={styles.stat}>{cpu === null ? '采样中' : `${cpu.toFixed(0)}%`}</strong>
          <ProgressBar label="当前总使用率" value={cpu || 0} variant={meterVariant(cpu || 0)} />
        </Card>
        <Card icon={MemoryStick} title="内存">
          <strong className={styles.stat}>
            {bytes(usedMemory)}
            <small> / {bytes(s.memory.total)}</small>
          </strong>
          {usedMemory !== null && (
            <ProgressBar label="内存使用量" valueLabel={`${memoryPercent.toFixed(0)}%`} value={memoryPercent} variant={meterVariant(memoryPercent)} />
          )}
          <div className={styles.cardRow}>
            <span>内存压力</span>
            <StatusLight variant={pressureVariants[s.memory.pressure]}>{pressureNames[s.memory.pressure]}</StatusLight>
          </div>
          <p className={styles.help}>已用量扣除文件缓存，为估算值。</p>
        </Card>
        <Card icon={SpeedFast} title="网络速度">
          <div className={styles.speeds}>
            <span>
              <small>接收</small>
              <strong className={styles.stat}>
                {bytes(s.network.receiveRate)}
                <small>/s</small>
              </strong>
            </span>
            <span>
              <small>发送</small>
              <strong className={styles.stat}>
                {bytes(s.network.sendRate)}
                <small>/s</small>
              </strong>
            </span>
          </div>
          <p className={styles.help}>当前物理网卡合计速度</p>
        </Card>
        <Card icon={Zap} title="供电与运行时间">
          <strong className={styles.stat}>
            {s.power.source === 'AC Power' ? '外接电源' : s.power.source === 'Battery Power' ? '电池供电' : s.power.source}
            {s.power.battery !== null && <small> · {s.power.battery}%</small>}
          </strong>
          {s.power.battery !== null && <ProgressBar label="电量" value={s.power.battery} variant={s.power.battery <= 20 ? 'negative' : 'positive'} />}
          <p className={styles.help}>
            连续运行 {Math.floor(uptime / 86400)} 天 {Math.floor((uptime % 86400) / 3600)} 小时 {Math.floor((uptime % 3600) / 60)} 分钟
          </p>
        </Card>
      </div>
      <Card icon={Data} title="存储">
        {s.volumes.length ? (
          <div className={styles.volumes}>
            {s.volumes.map((volume) => {
              const startup = volume.mount === '/' || volume.mount === '/System/Volumes/Data'
              const name = startup ? '启动磁盘' : volume.mount.split('/').pop()
              const used = Math.max(0, volume.total - volume.available)
              const percent = percentOf(used, volume.total)
              return (
                <div key={volume.mount}>
                  <ProgressBar
                    label={name}
                    valueLabel={`${bytes(volume.available)} 可用 / 共 ${bytes(volume.total)}`}
                    value={percent}
                    variant={meterVariant(percent)}
                  />
                  <p className={styles.help}>已使用 {bytes(used)}</p>
                </div>
              )
            })}
          </div>
        ) : (
          <p className={styles.help}>暂时无法读取存储信息</p>
        )}
      </Card>
      <p className={styles.note}>约每 5 秒自动更新。CPU 和网络速度需要相邻两次采样；无法读取的数据会显示为未知。</p>
    </div>
  )
}

function Card({ icon: Icon, title, children }: { icon: Icon; title: string; children: ReactNode }) {
  return (
    <section className={styles.card}>
      <h3 className={styles.cardTitle}>
        <Icon size="M" />
        {title}
      </h3>
      {children}
    </section>
  )
}

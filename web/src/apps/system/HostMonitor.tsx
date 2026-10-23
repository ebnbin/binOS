import type { MonitorStatus } from '@binos/server/apps/system/types'
import type { ReactNode } from 'react'
import { ArrowDownward, ArrowUpward, HardDrive, Lan, Memory, MemoryAlt, Power } from '../../ui/icons.tsx'
import type { Icon } from '../../ui/icons.tsx'
import { LinearProgress } from '../../ui/Progress.tsx'
import { bytes } from './format.ts'
import styles from './Monitor.module.css'

const pressureNames = { normal: '正常', warning: '偏高', critical: '很高', unknown: '未知' }
export function HostMonitor({ status }: { status: MonitorStatus }) {
  const s = status.snapshot
  if (!s) return <p className={styles.empty}>正在读取 Mac 状态…</p>
  const usedMemory = s.memory.cached === null ? null : Math.max(0, s.memory.total - s.memory.free - s.memory.cached)
  const cpu = s.cpu.percent
  const uptime = s.host.uptime
  return (
    <div className={styles.content}>
      <header className={styles.hero}>
        <h1>{s.host.name}</h1>
        <p>
          {s.host.chip} · {s.host.cores} 核 · {s.host.os}
        </p>
      </header>
      {s.unavailable.length > 0 && <p className={styles.notice}>{s.unavailable.join('、')}暂时无法读取，其他信息仍会更新。</p>}
      <div className={styles.cards}>
        <Card icon={Memory} title="CPU">
          <strong className={styles.value}>{cpu === null ? '采样中' : `${cpu.toFixed(0)}%`}</strong>
          <LinearProgress label="CPU 使用率" value={(cpu || 0) / 100} />
          <p>当前总使用率</p>
        </Card>
        <Card icon={MemoryAlt} title="内存">
          <strong className={styles.value}>
            {bytes(usedMemory)}
            <small> / {bytes(s.memory.total)}</small>
          </strong>
          {usedMemory !== null && <LinearProgress label="内存使用量" value={usedMemory / (s.memory.total || 1)} />}
          <p>
            内存压力：
            <span className={s.memory.pressure === 'warning' || s.memory.pressure === 'critical' ? styles.bad : ''}>{pressureNames[s.memory.pressure]}</span>
          </p>
          <small className={styles.note}>已用量扣除文件缓存，为估算值。</small>
        </Card>
        <Card icon={Lan} title="网络速度">
          <div className={styles.speeds}>
            <span>
              <ArrowDownward size={20} className={styles.receive} />
              <strong>{bytes(s.network.receiveRate)}</strong>
              <small>/s 接收</small>
            </span>
            <span>
              <ArrowUpward size={20} className={styles.send} />
              <strong>{bytes(s.network.sendRate)}</strong>
              <small>/s 发送</small>
            </span>
          </div>
          <p>当前物理网卡合计速度</p>
        </Card>
        <Card icon={Power} title="供电与运行时间">
          <strong className={styles.value}>
            {s.power.source === 'AC Power' ? '外接电源' : s.power.source === 'Battery Power' ? '电池供电' : s.power.source}
            {s.power.battery !== null && <small> · {s.power.battery}%</small>}
          </strong>
          <p>
            连续运行 {Math.floor(uptime / 86400)} 天 {Math.floor((uptime % 86400) / 3600)} 小时 {Math.floor((uptime % 3600) / 60)} 分钟
          </p>
        </Card>
      </div>
      <section className={styles.section}>
        <h2>存储</h2>
        {s.volumes.length ? (
          <div className={styles.group}>
            {s.volumes.map((volume) => {
              const startup = volume.mount === '/' || volume.mount === '/System/Volumes/Data'
              const name = startup ? '启动磁盘' : volume.mount.split('/').pop()
              const used = Math.max(0, volume.total - volume.available)
              return (
                <article key={volume.mount} className={styles.volume}>
                  <HardDrive size={24} className={styles.leading} />
                  <div>
                    <header>
                      <strong>{name}</strong>
                      <span>
                        {bytes(volume.available)} 可用 / 共 {bytes(volume.total)}
                      </span>
                    </header>
                    <LinearProgress label={`${name}使用量`} value={used / (volume.total || 1)} />
                    <p>已使用 {bytes(used)}</p>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <p className={styles.note}>暂时无法读取存储信息</p>
        )}
      </section>
      <p className={styles.note}>约每 5 秒自动更新。CPU 和网络速度需要相邻两次采样；无法读取的数据会显示为未知。</p>
    </div>
  )
}

function Card({ icon: Glyph, title, children }: { icon: Icon; title: string; children: ReactNode }) {
  return (
    <section className={styles.card}>
      <h2>
        <span className={styles.cardIcon}>
          <Glyph size={20} />
        </span>
        {title}
      </h2>
      {children}
    </section>
  )
}

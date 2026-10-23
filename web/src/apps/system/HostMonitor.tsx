import type { MonitorStatus } from '@binos/server/apps/system/types'
import { ArrowDownIcon, ArrowUpIcon, CpuIcon, DatabaseIcon, GlobeIcon, PlugIcon, ServerIcon } from '@primer/octicons-react'
import { Alert } from '../../ui/Alert.tsx'
import { Label } from '../../ui/Label.tsx'
import type { LabelVariant } from '../../ui/Label.tsx'
import { ProgressBar } from '../../ui/ProgressBar.tsx'
import type { ProgressTone } from '../../ui/ProgressBar.tsx'
import { Spinner } from '../../ui/Spinner.tsx'
import { bytes } from './format.ts'
import styles from './Monitor.module.css'

const pressureNames = { normal: '正常', warning: '偏高', critical: '很高', unknown: '未知' }
const pressureLabels: Record<keyof typeof pressureNames, LabelVariant> = { normal: 'success', warning: 'attention', critical: 'danger', unknown: 'default' }

// 用量越高越醒目：75% 起提醒，90% 起告警
const tone = (ratio: number): ProgressTone => (ratio >= 0.9 ? 'danger' : ratio >= 0.75 ? 'attention' : 'accent')

export function HostMonitor({ status }: { status: MonitorStatus }) {
  const s = status.snapshot
  if (!s)
    return (
      <p className={styles.loading}>
        <Spinner />
        正在读取 Mac 状态…
      </p>
    )
  const usedMemory = s.memory.cached === null ? null : Math.max(0, s.memory.total - s.memory.free - s.memory.cached)
  const cpu = s.cpu.percent
  const uptime = s.host.uptime
  return (
    <div className={styles.content}>
      <header className={styles.subhead}>
        <h2>{s.host.name}</h2>
        <p>
          {s.host.chip} · {s.host.cores} 核 · {s.host.os}
        </p>
      </header>
      {s.unavailable.length > 0 && <Alert variant="warning" className={styles.banner}>{s.unavailable.join('、')}暂时无法读取，其他信息仍会更新。</Alert>}
      <div className={styles.cards}>
        <section className={styles.box}>
          <h3 className={styles.boxHeader}>
            <CpuIcon size={16} />
            CPU
          </h3>
          <div className={styles.boxBody}>
            <strong className={styles.value}>{cpu === null ? '采样中' : `${cpu.toFixed(0)}%`}</strong>
            <ProgressBar label="CPU 使用率" progress={cpu || 0} tone={tone((cpu || 0) / 100)} />
            <p className={styles.caption}>当前总使用率</p>
          </div>
        </section>
        <section className={styles.box}>
          <h3 className={styles.boxHeader}>
            <ServerIcon size={16} />
            内存
          </h3>
          <div className={styles.boxBody}>
            <strong className={styles.value}>
              {bytes(usedMemory)}
              <small> / {bytes(s.memory.total)}</small>
            </strong>
            {usedMemory !== null && <ProgressBar label="内存使用量" progress={(usedMemory / (s.memory.total || 1)) * 100} tone={tone(usedMemory / (s.memory.total || 1))} />}
            <p className={styles.caption}>
              内存压力
              <Label variant={pressureLabels[s.memory.pressure]}>{pressureNames[s.memory.pressure]}</Label>
            </p>
            <small className={styles.note}>已用量扣除文件缓存，为估算值。</small>
          </div>
        </section>
        <section className={styles.box}>
          <h3 className={styles.boxHeader}>
            <GlobeIcon size={16} />
            网络速度
          </h3>
          <div className={styles.boxBody}>
            <div className={styles.speeds}>
              <span>
                <span className={styles.direction}>
                  <ArrowDownIcon size={16} />
                  接收
                </span>
                <strong>
                  {bytes(s.network.receiveRate)}
                  <small>/s</small>
                </strong>
              </span>
              <span>
                <span className={styles.direction}>
                  <ArrowUpIcon size={16} />
                  发送
                </span>
                <strong>
                  {bytes(s.network.sendRate)}
                  <small>/s</small>
                </strong>
              </span>
            </div>
            <p className={styles.caption}>当前物理网卡合计速度</p>
          </div>
        </section>
        <section className={styles.box}>
          <h3 className={styles.boxHeader}>
            <PlugIcon size={16} />
            供电与运行时间
          </h3>
          <div className={styles.boxBody}>
            <strong className={styles.value}>
              {s.power.source === 'AC Power' ? '外接电源' : s.power.source === 'Battery Power' ? '电池供电' : s.power.source}
              {s.power.battery !== null && <small> · {s.power.battery}%</small>}
            </strong>
            <p className={styles.caption}>
              连续运行 {Math.floor(uptime / 86400)} 天 {Math.floor((uptime % 86400) / 3600)} 小时 {Math.floor((uptime % 3600) / 60)} 分钟
            </p>
          </div>
        </section>
      </div>
      <section className={styles.box}>
        <h3 className={styles.boxHeader}>
          <DatabaseIcon size={16} />
          存储
        </h3>
        {s.volumes.length ? (
          s.volumes.map((volume) => {
            const startup = volume.mount === '/' || volume.mount === '/System/Volumes/Data'
            const name = startup ? '启动磁盘' : volume.mount.split('/').pop()
            const used = Math.max(0, volume.total - volume.available)
            return (
              <article key={volume.mount} className={styles.boxRow}>
                <header className={styles.volumeHeader}>
                  <strong>{name}</strong>
                  <span>
                    {bytes(volume.available)} 可用 / 共 {bytes(volume.total)}
                  </span>
                </header>
                <ProgressBar label={`${name}使用量`} progress={(used / (volume.total || 1)) * 100} tone={tone(used / (volume.total || 1))} />
                <p className={styles.caption}>已使用 {bytes(used)}</p>
              </article>
            )
          })
        ) : (
          <p className={`${styles.boxRow} ${styles.note}`}>暂时无法读取存储信息</p>
        )}
      </section>
      <p className={styles.note}>约每 5 秒自动更新。CPU 和网络速度需要相邻两次采样；无法读取的数据会显示为未知。</p>
    </div>
  )
}

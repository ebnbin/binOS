import type { MonitorStatus } from '@binos/server/apps/system/types'
import { DeveloperBoardRegular } from '@fluentui/react-icons/headless/svg/developer-board'
import { HardDriveRegular } from '@fluentui/react-icons/headless/svg/hard-drive'
import { NetworkCheckRegular } from '@fluentui/react-icons/headless/svg/network-check'
import { PlugConnectedRegular } from '@fluentui/react-icons/headless/svg/plug-connected'
import { RamRegular } from '@fluentui/react-icons/headless/svg/ram'
import { Alert } from '../../ui/Alert.tsx'
import { ProgressBar } from '../../ui/ProgressBar.tsx'
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
      {s.unavailable.length > 0 && <Alert intent="warning" className={styles.contentAlert}>{s.unavailable.join('、')}暂时无法读取，其他信息仍会更新。</Alert>}
      <div className={styles.cards}>
        <section className={styles.card}>
          <h2>
            <DeveloperBoardRegular className={styles.cardIcon} />
            CPU
          </h2>
          <strong>{cpu === null ? '采样中' : `${cpu.toFixed(0)}%`}</strong>
          <ProgressBar thickness="large" label="CPU 使用率" value={(cpu || 0) / 100} />
          <p>当前总使用率</p>
        </section>
        <section className={styles.card}>
          <h2>
            <RamRegular className={styles.cardIcon} />
            内存
          </h2>
          <strong>
            {bytes(usedMemory)}
            <small> / {bytes(s.memory.total)}</small>
          </strong>
          {usedMemory !== null && <ProgressBar thickness="large" label="内存使用量" value={s.memory.total ? usedMemory / s.memory.total : 0} />}
          <p>
            内存压力：
            <span className={s.memory.pressure === 'warning' || s.memory.pressure === 'critical' ? styles.bad : ''}>{pressureNames[s.memory.pressure]}</span>
          </p>
          <small className={styles.note}>已用量扣除文件缓存，为估算值。</small>
        </section>
        <section className={styles.card}>
          <h2>
            <NetworkCheckRegular className={styles.cardIcon} />
            网络速度
          </h2>
          <div className={styles.speeds}>
            <span>
              ↓ <strong>{bytes(s.network.receiveRate)}</strong>
              <small>/s 接收</small>
            </span>
            <span>
              ↑ <strong>{bytes(s.network.sendRate)}</strong>
              <small>/s 发送</small>
            </span>
          </div>
          <p>当前物理网卡合计速度</p>
        </section>
        <section className={styles.card}>
          <h2>
            <PlugConnectedRegular className={styles.cardIcon} />
            供电与运行时间
          </h2>
          <strong>
            {s.power.source === 'AC Power' ? '外接电源' : s.power.source === 'Battery Power' ? '电池供电' : s.power.source}
            {s.power.battery !== null && <small> · {s.power.battery}%</small>}
          </strong>
          <p>
            连续运行 {Math.floor(uptime / 86400)} 天 {Math.floor((uptime % 86400) / 3600)} 小时 {Math.floor((uptime % 3600) / 60)} 分钟
          </p>
        </section>
      </div>
      <section className={styles.section}>
        <h2>
          <HardDriveRegular className={styles.cardIcon} />
          存储
        </h2>
        {s.volumes.length ? (
          s.volumes.map((volume) => {
            const startup = volume.mount === '/' || volume.mount === '/System/Volumes/Data'
            const name = startup ? '启动磁盘' : volume.mount.split('/').pop()
            return (
              <article key={volume.mount} className={styles.volume}>
                <header>
                  <strong>{name}</strong>
                  <span>
                    {bytes(volume.available)} 可用 / 共 {bytes(volume.total)}
                  </span>
                </header>
                <ProgressBar thickness="large" label={`${name}使用量`} value={Math.max(0, volume.total - volume.available) / (volume.total || 1)} />
                <p>已使用 {bytes(Math.max(0, volume.total - volume.available))}</p>
              </article>
            )
          })
        ) : (
          <p className={styles.note}>暂时无法读取存储信息</p>
        )}
      </section>
      <p className={styles.note}>约每 5 秒自动更新。CPU 和网络速度需要相邻两次采样；无法读取的数据会显示为未知。</p>
    </div>
  )
}

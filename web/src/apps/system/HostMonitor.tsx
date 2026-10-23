import type { MonitorStatus } from '@binos/server/apps/system/types'
import { Badge, Callout, Card, Flex, Heading, Progress, Text } from '@radix-ui/themes'
import type { ReactNode } from 'react'
import { ArrowDownIcon, ArrowUpIcon, CpuIcon, ExclamationTriangleIcon, HardDriveIcon, MemoryIcon, NetworkIcon, PlugZapIcon } from '../../ui/icons.ts'
import type { Icon } from '../../ui/icons.ts'
import { bytes } from './format.ts'
import styles from './Monitor.module.css'

const pressures = {
  normal: { name: '正常', color: 'green' },
  warning: { name: '偏高', color: 'amber' },
  critical: { name: '很高', color: 'red' },
  unknown: { name: '未知', color: 'gray' },
} as const

export function HostMonitor({ status }: { status: MonitorStatus }) {
  const s = status.snapshot
  if (!s)
    return (
      <Text as="p" size="2" color="gray" className={styles.empty}>
        正在读取 Mac 状态…
      </Text>
    )
  const usedMemory = s.memory.cached === null ? null : Math.max(0, s.memory.total - s.memory.free - s.memory.cached)
  const cpu = s.cpu.percent
  const uptime = s.host.uptime
  const pressure = pressures[s.memory.pressure]
  return (
    <div className={styles.content}>
      <header className={styles.hero}>
        <Heading as="h2" size="6" className={styles.wrap}>
          {s.host.name}
        </Heading>
        <Text as="p" size="2" color="gray">
          {s.host.chip} · {s.host.cores} 核 · {s.host.os}
        </Text>
      </header>
      {s.unavailable.length > 0 && (
        <Callout.Root color="amber" size="1">
          <Callout.Icon>
            <ExclamationTriangleIcon />
          </Callout.Icon>
          <Callout.Text>{s.unavailable.join('、')}暂时无法读取，其他信息仍会更新。</Callout.Text>
        </Callout.Root>
      )}
      <div className={styles.cards}>
        <Metric icon={CpuIcon} title="CPU">
          <Text as="div" size="6" weight="bold" className={styles.figure}>
            {cpu === null ? '采样中' : `${cpu.toFixed(0)}%`}
          </Text>
          <Progress className={styles.meter} aria-label="CPU 使用率" max={100} value={cpu || 0} />
          <Text as="p" size="1" color="gray">
            当前总使用率
          </Text>
        </Metric>
        <Metric icon={MemoryIcon} title="内存">
          <Text as="div" size="6" weight="bold" className={styles.figure}>
            {bytes(usedMemory)}
            <Text size="2" weight="regular" color="gray"> / {bytes(s.memory.total)}</Text>
          </Text>
          {usedMemory !== null && <Progress className={styles.meter} aria-label="内存使用量" max={s.memory.total} value={usedMemory} />}
          <Flex align="center" gap="2">
            <Text size="1" color="gray">
              内存压力
            </Text>
            <Badge size="1" variant="soft" color={pressure.color}>
              {pressure.name}
            </Badge>
          </Flex>
          <Text as="p" size="1" color="gray">
            已用量扣除文件缓存，为估算值。
          </Text>
        </Metric>
        <Metric icon={NetworkIcon} title="网络速度">
          <div className={styles.speeds}>
            <Speed icon={ArrowDownIcon} label="接收" value={s.network.receiveRate} />
            <Speed icon={ArrowUpIcon} label="发送" value={s.network.sendRate} />
          </div>
          <Text as="p" size="1" color="gray">
            当前物理网卡合计速度
          </Text>
        </Metric>
        <Metric icon={PlugZapIcon} title="供电与运行时间">
          <Text as="div" size="6" weight="bold" className={styles.figure}>
            {s.power.source === 'AC Power' ? '外接电源' : s.power.source === 'Battery Power' ? '电池供电' : s.power.source}
            {s.power.battery !== null && <Text size="2" weight="regular" color="gray"> · {s.power.battery}%</Text>}
          </Text>
          <Text as="p" size="1" color="gray" className={styles.numeric}>
            连续运行 {Math.floor(uptime / 86400)} 天 {Math.floor((uptime % 86400) / 3600)} 小时 {Math.floor((uptime % 3600) / 60)} 分钟
          </Text>
        </Metric>
      </div>
      <Card size="2">
        <CardTitle icon={HardDriveIcon} title="存储" />
        {s.volumes.length ? (
          s.volumes.map((volume) => {
            const startup = volume.mount === '/' || volume.mount === '/System/Volumes/Data'
            const name = startup ? '启动磁盘' : volume.mount.split('/').pop()
            const used = Math.max(0, volume.total - volume.available)
            return (
              <article key={volume.mount} className={styles.volume}>
                <Flex align="baseline" justify="between" wrap="wrap" gap="2">
                  <Text size="2" weight="medium">
                    {name}
                  </Text>
                  <Text size="1" color="gray" className={styles.numeric}>
                    {bytes(volume.available)} 可用 / 共 {bytes(volume.total)}
                  </Text>
                </Flex>
                <Progress className={styles.meter} aria-label={`${name}使用量`} max={volume.total || 1} value={used} />
                <Text as="p" size="1" color="gray" className={styles.numeric}>
                  已使用 {bytes(used)}
                </Text>
              </article>
            )
          })
        ) : (
          <Text as="p" size="1" color="gray">
            暂时无法读取存储信息
          </Text>
        )}
      </Card>
      <Text as="p" size="1" color="gray">
        约每 5 秒自动更新。CPU 和网络速度需要相邻两次采样；无法读取的数据会显示为未知。
      </Text>
    </div>
  )
}

function CardTitle({ icon: Glyph, title }: { icon: Icon; title: string }) {
  return (
    <Flex align="center" gap="2" className={styles.cardTitle}>
      <Glyph />
      <Heading as="h3" size="2" weight="medium">
        {title}
      </Heading>
    </Flex>
  )
}

function Metric({ icon, title, children }: { icon: Icon; title: string; children: ReactNode }) {
  return (
    <Card size="2" asChild>
      <section className={styles.metric}>
        <CardTitle icon={icon} title={title} />
        {children}
      </section>
    </Card>
  )
}

function Speed({ icon: Glyph, label, value }: { icon: Icon; label: string; value: number | null | undefined }) {
  return (
    <Flex direction="column" gap="1">
      <Flex asChild align="center" gap="1">
        <Text size="1" color="gray">
          <Glyph />
          {label}
        </Text>
      </Flex>
      <Text as="div" size="6" weight="bold" className={styles.figure}>
        {bytes(value)}
        <Text size="2" weight="regular" color="gray">/s</Text>
      </Text>
    </Flex>
  )
}

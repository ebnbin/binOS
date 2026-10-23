import { Badge, Box, Button, Callout, Card, DataList, Flex, Heading, Link, Text, TextField } from '@radix-ui/themes'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { DevicesSnapshot } from '@binos/server/apps/devices/api'
import type { Device, Platform } from '@binos/server/apps/devices/types'
import type { WindowContext } from '../types.ts'
import { onChange } from '../../events.ts'
import { acquireDevices, cancelDevices, captureDevice, controlDevice, discoverDevices, readDevices, releaseDevices } from './api.ts'
import { Alert } from '../../ui/Alert.tsx'
import { IconButton } from '../../ui/IconButton.tsx'
import { CameraIcon, InfoCircledIcon, MagnifyingGlassIcon, MobileIcon, ReloadIcon, TrashIcon } from '../../ui/icons.ts'
import { Select } from '../../ui/Select.tsx'
import styles from './DevicesApp.module.css'

const labels = { creating: '初始化中', checking: '检查中', free: '闲置', reserved: '整组预留', leased: '使用中', cleaning: '清理中', destroying: '回收中', broken: '故障隔离' }
const statusColors = { creating: 'gray', checking: 'gray', free: 'green', reserved: 'amber', leased: 'blue', cleaning: 'gray', destroying: 'gray', broken: 'red' } as const
const platforms = [
  { value: 'both', label: 'Android + iOS' },
  { value: 'android', label: 'Android' },
  { value: 'ios', label: 'iOS' },
]
const ownerName = (owner: string) => owner === 'manual' ? '手动使用' : owner
const moment = (time: number) => new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
export function DevicesApp({ ctx }: { ctx: WindowContext }) {
  const [data, setData] = useState<DevicesSnapshot>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [platform, setPlatform] = useState('both')
  const [reason, setReason] = useState('手动验证')
  const latest = useRef(0)
  const { setTitle } = ctx
  useEffect(() => setTitle('设备'), [setTitle])
  const load = useCallback(async () => {
    const version = ++latest.current
    try { const result = await readDevices(); if (latest.current === version) { setData(result); setError('') } }
    catch (error) { if (latest.current === version) setError(error instanceof Error ? error.message : '读取失败') }
  }, [])
  useEffect(() => {
    const initial = setTimeout(() => void load(), 0)
    const timer = setInterval(() => { if (!document.hidden) void load() }, 5000)
    const stop = onChange((event) => { if (event === null || event.type === 'devices') void load() })
    return () => { clearTimeout(initial); clearInterval(timer); stop() }
  }, [load])
  async function act(operation: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try { await operation(); await load() }
    catch (error) { setError(error instanceof Error ? error.message : '操作失败') }
    finally { setBusy(false) }
  }
  const own = data?.leases.find((lease) => lease.owner === 'manual')
  const waiting = data?.queue.some((item) => item.owner === 'manual')
  const manualRequest = data?.queue.find((item) => item.owner === 'manual')
  const pendingRequest = (manualRequest?.phase === 'failed' ? undefined : manualRequest) ?? (own && !own.claimed ? own : undefined)
  const pendingPlatforms = pendingRequest?.platforms.join(',')
  const pendingReason = pendingRequest?.reason
  const pendingId = manualRequest?.id ?? own?.requestId
  const pendingLease = own && !own.claimed ? own.id : undefined
  useEffect(() => {
    if (!pendingPlatforms) return
    const refresh = () => {
      void acquireDevices(pendingPlatforms.split(',') as Platform[], pendingReason ?? '', pendingId).then(load).catch(() => {})
    }
    const initial = setTimeout(refresh, 0)
    const timer = setInterval(refresh, 30_000)
    return () => { clearTimeout(initial); clearInterval(timer) }
  }, [pendingPlatforms, pendingReason, pendingLease, pendingId, load])

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div>
          <Heading as="h1" size="6">
            Devices{' '}
            <Text size="4" weight="regular" color="gray">
              设备
            </Text>
          </Heading>
          <Text as="p" size="2" color="gray" mt="1">
            开发测试设备与会话调度
          </Text>
        </div>
        <IconButton icon={ReloadIcon} label="刷新设备" variant="soft" disabled={busy} onClick={() => void act(load)} />
      </header>
      {data?.mode === 'mock' && (
        <Callout.Root size="1" color="blue">
          <Callout.Icon>
            <InfoCircledIcon />
          </Callout.Icon>
          <Callout.Text>模拟设备预览 · 所有操作与正式设备隔离</Callout.Text>
        </Callout.Root>
      )}
      {error && <Alert>{error}</Alert>}
      {!data ? (
        <Text as="p" size="2" color="gray" className={styles.empty}>
          {error ? '设备服务暂时不可用' : '正在连接设备管理服务…'}
        </Text>
      ) : (
        <>
          <section className={styles.summary}>
            <Stat value={data.devices.filter((device) => device.status === 'free').length} label="闲置设备" />
            <Stat value={data.leases.length} label="使用会话" />
            <Stat value={data.queue.filter((item) => item.phase !== 'failed').length} label="排队会话" />
          </section>
          <Text as="p" size="1" color="gray" className={styles.numeric}>
            设备池 {data.devices.length} / {data.capacity} · 按需创建 · 闲置一小时后销毁 · 双端全部就绪后交付
          </Text>
          <form
            className={styles.acquire}
            onSubmit={(event) => {
              event.preventDefault()
              void act(() => acquireDevices(platform === 'both' ? ['android', 'ios'] : [platform as Platform], reason))
            }}
          >
            <Select label="申请平台" value={platform} options={platforms} onValueChange={setPlatform} disabled={busy || Boolean(own) || waiting} />
            <TextField.Root
              className={styles.reason}
              aria-label="使用用途"
              value={reason}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              placeholder="使用用途"
              disabled={busy || Boolean(own) || waiting}
            />
            {own ? (
              <Button type="button" variant="soft" color="gray" disabled={busy} onClick={() => void act(() => releaseDevices(own.id))}>
                归还我的设备
              </Button>
            ) : waiting ? (
              <Button type="button" variant="soft" color="gray" disabled={busy} onClick={() => void act(() => cancelDevices(manualRequest!.id))}>
                取消申请
              </Button>
            ) : (
              <Button type="submit" disabled={busy}>
                申请设备
              </Button>
            )}
          </form>
          {own && (
            <Text as="p" size="1" color="gray">
              手动租约空闲 15 分钟后回收。查看截图不会延长占用。
            </Text>
          )}
          {data.devices.length === 0 && (
            <Text as="p" size="2" color="gray" className={styles.empty}>
              设备池为空，申请时会自动创建专属设备。
            </Text>
          )}
          <div className={styles.grid}>
            {data.devices.map((device) => (
              <DeviceCard
                key={`${device.id}-${device.status}-${data.leases.find((item) => item.devices.includes(device.id))?.id ?? ''}`}
                device={device}
                data={data}
                ctx={ctx}
                busy={busy}
                act={act}
              />
            ))}
          </div>
          <section className={styles.section}>
            <Heading as="h2" size="4">
              排队
            </Heading>
            {data.queue.length ? (
              <ol className={styles.queue}>
                {data.queue.map((item) => (
                  <li key={item.owner}>
                    <Text as="div" size="2" weight="medium">
                      {data.owners[item.owner]?.title || ownerName(item.owner)}
                    </Text>
                    <Text as="div" size="1" color="gray">
                      {item.platforms.join(' + ')} · {item.phase === 'preparing' ? '正在准备整组设备' : item.phase === 'failed' ? item.error : '等待容量'} · {item.reason || '未填写用途'}
                    </Text>
                  </li>
                ))}
              </ol>
            ) : (
              <Text as="p" size="1" color="gray">
                没有等待中的申请
              </Text>
            )}
          </section>
          <section className={styles.section}>
            <Flex align="center" justify="between" gap="3">
              <Heading as="h2" size="4">
                已有模拟器
              </Heading>
              <Button
                size="1"
                variant="soft"
                color="gray"
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    const result = await discoverDevices()
                    setData(result)
                  })
                }
              >
                <MagnifyingGlassIcon />
                只读发现
              </Button>
            </Flex>
            <Text as="p" size="1" color="gray">
              这些设备不参与分配，也不会被清理或接管。
            </Text>
            {data.observed.length > 0 && (
              <ul className={styles.rows}>
                {data.observed.map((item) => (
                  <li key={`${item.platform}-${item.target}`}>
                    <Text size="2">{item.name}</Text>
                    <Text size="1" color="gray">
                      {item.platform} · {item.state}
                    </Text>
                  </li>
                ))}
              </ul>
            )}
            {data.discoveryErrors.map((text) => (
              <Alert key={text}>{text}</Alert>
            ))}
          </section>
          <section className={styles.section}>
            <Heading as="h2" size="4">
              操作记录
            </Heading>
            <ul className={styles.events}>
              {[...data.events]
                .reverse()
                .slice(0, 30)
                .map((item, index) => (
                  <li key={`${item.time}-${index}`}>
                    <Text as="span" size="1" color="gray" className={styles.time}>
                      <time>{moment(item.time)}</time>
                    </Text>
                    <Flex direction="column" minWidth="0">
                      <Text size="2">{item.text}</Text>
                      {item.owner && (
                        <Text size="1" color="gray" className={styles.wrap}>
                          {data.owners[item.owner]?.title || ownerName(item.owner)}
                        </Text>
                      )}
                    </Flex>
                  </li>
                ))}
            </ul>
          </section>
          <Text as="p" size="1" color="gray" className={styles.footer}>
            独立设备管理服务 · 启动于 {moment(data.startedAt)}
          </Text>
        </>
      )}
    </div>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <Card size="2">
      <Flex direction="column" gap="1">
        <Text size="7" weight="bold" className={styles.numeric}>
          {value}
        </Text>
        <Text size="1" color="gray">
          {label}
        </Text>
      </Flex>
    </Card>
  )
}

function DeviceCard({ device, data, ctx, busy, act }: { device: Device; data: DevicesSnapshot; ctx: WindowContext; busy: boolean; act: (operation: () => Promise<unknown>) => Promise<void> }) {
  const [confirmDestroy, setConfirmDestroy] = useState(false)
  const [capture, setCapture] = useState<Awaited<ReturnType<typeof captureDevice>>>()
  const lease = data.leases.find((item) => item.devices.includes(device.id))
  const session = lease && data.owners[lease.owner]
  const system = device.system?.replace('com.apple.CoreSimulator.SimRuntime.', '').replaceAll('-', '.') ?? (device.platform === 'ios' ? 'iOS' : 'Android')
  return (
    <Card size="2" asChild>
      <article className={styles.card}>
        <Flex align="center" gap="3">
          <MobileIcon width={20} height={20} className={styles.cardIcon} />
          <Box flexGrow="1" minWidth="0">
            <Heading as="h3" size="3" className={styles.wrap}>
              {device.platform === 'ios' ? 'iOS' : 'Android'} · {device.id.slice(-8)}
            </Heading>
            <Text as="p" size="1" color="gray">
              {system}
            </Text>
          </Box>
          <Badge size="1" variant="soft" color={statusColors[device.status]}>
            {labels[device.status]}
          </Badge>
        </Flex>
        {capture ? (
          <img className={styles.screenshot} src={`data:${capture.mime};base64,${capture.image}`} alt={`${device.name} 屏幕截图`} />
        ) : (
          <div className={styles.placeholder}>
            <MobileIcon width={32} height={32} />
            <Text size="1">按需查看设备画面</Text>
          </div>
        )}
        {capture && (
          <Text as="p" size="1" color="gray">
            截图于 {moment(capture.at)} · 非实时画面
          </Text>
        )}
        <DataList.Root size="1">
          <DataList.Item>
            <DataList.Label minWidth="48px">设备</DataList.Label>
            <DataList.Value>{device.id}</DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label minWidth="48px">占用</DataList.Label>
            <DataList.Value>
              {session && ctx.openApplication ? (
                <Link asChild size="1">
                  <button type="button" onClick={() => ctx.openApplication?.('code', `/${session.session}`)}>
                    {session.title || `会话 ${session.session}`}
                  </button>
                </Link>
              ) : lease ? (
                ownerName(lease.owner)
              ) : (
                '无'
              )}
            </DataList.Value>
          </DataList.Item>
          {lease && (
            <>
              <DataList.Item>
                <DataList.Label minWidth="48px">用途</DataList.Label>
                <DataList.Value>{lease.reason || '未填写'}</DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label minWidth="48px">开始</DataList.Label>
                <DataList.Value>{moment(lease.createdAt)}</DataList.Value>
              </DataList.Item>
            </>
          )}
        </DataList.Root>
        {device.error && <Alert>{device.error}</Alert>}
        <Flex gap="2" wrap="wrap" mt="auto">
          <Button
            size="1"
            variant="soft"
            color="gray"
            disabled={busy || !['free', 'reserved', 'leased'].includes(device.status) || Boolean(device.error)}
            onClick={() => void act(async () => setCapture(await captureDevice(device.id)))}
          >
            <CameraIcon />
            截图
          </Button>
          {device.status !== 'destroying' && (
            <Button
              size="1"
              variant={confirmDestroy ? 'solid' : 'soft'}
              color="red"
              disabled={busy}
              onClick={() => {
                if (!confirmDestroy) {
                  setConfirmDestroy(true)
                  return
                }
                void act(() => controlDevice(device.id, 'destroy'))
              }}
            >
              <TrashIcon />
              {confirmDestroy ? (lease ? '确认中断租约并销毁' : '确认销毁设备') : lease ? '强制回收' : '销毁设备'}
            </Button>
          )}
          {confirmDestroy && (
            <Button size="1" variant="soft" color="gray" disabled={busy} onClick={() => setConfirmDestroy(false)}>
              取消
            </Button>
          )}
        </Flex>
      </article>
    </Card>
  )
}

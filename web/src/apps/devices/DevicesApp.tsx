import { Alert as MaterialAlert, Button, Card, Chip, IconButton as MaterialIconButton } from '@mui/material'

import { Input, SelectInput } from '../../ui/Input.tsx'

import { RefreshCw, Smartphone, Camera, Wrench, Play, ExternalLink } from '../../ui/icons.tsx'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { DevicesSnapshot } from '@binos/server/apps/devices/api'
import type { Device, Platform } from '@binos/server/apps/devices/types'
import type { WindowContext } from '../types.ts'
import { onChange } from '../../events.ts'
import { acquireDevices, cancelDevices, captureDevice, controlDevice, discoverDevices, readDevices, releaseDevices } from './api.ts'
import styles from './DevicesApp.module.css'

const labels = { free: '可用', reserved: '等待领取', leased: '使用中', cleaning: '清理中', broken: '故障', maintenance: '维护中' }
const ownerName = (owner: string) => (owner === 'manual' ? '手动使用' : owner)
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
    try {
      const result = await readDevices()
      if (latest.current === version) {
        setData(result)
        setError('')
      }
    } catch (error) {
      if (latest.current === version) setError(error instanceof Error ? error.message : '读取失败')
    }
  }, [])
  useEffect(() => {
    const initial = setTimeout(() => void load(), 0)
    const timer = setInterval(() => {
      if (!document.hidden) void load()
    }, 5000)
    const stop = onChange((event) => {
      if (event === null || event.type === 'devices') void load()
    })
    return () => {
      clearTimeout(initial)
      clearInterval(timer)
      stop()
    }
  }, [load])
  async function act(operation: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try {
      await operation()
      await load()
    } catch (error) {
      setError(error instanceof Error ? error.message : '操作失败')
    } finally {
      setBusy(false)
    }
  }
  const own = data?.leases.find((lease) => lease.owner === 'manual')
  const waiting = data?.queue.some((item) => item.owner === 'manual')
  const manualRequest = data?.queue.find((item) => item.owner === 'manual')
  const pendingRequest = manualRequest ?? (own && !own.claimed ? own : undefined)
  const pendingPlatforms = pendingRequest?.platforms.join(',')
  const pendingReason = pendingRequest?.reason
  const pendingLease = own && !own.claimed ? own.id : undefined
  useEffect(() => {
    if (!pendingPlatforms) return
    const refresh = () => {
      void acquireDevices(pendingPlatforms.split(',') as Platform[], pendingReason ?? '')
        .then(load)
        .catch(() => {})
    }
    const initial = setTimeout(refresh, 0)
    const timer = setInterval(refresh, 30_000)
    return () => {
      clearTimeout(initial)
      clearInterval(timer)
    }
  }, [pendingPlatforms, pendingReason, pendingLease, load])

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div>
          <h1>
            Devices <span>设备</span>
          </h1>
          <p>开发测试设备与会话调度</p>
        </div>
        <MaterialIconButton type="submit" className={styles.icon} aria-label="刷新设备" disabled={busy} onClick={() => void act(load)}>
          <RefreshCw size={18} />
        </MaterialIconButton>
      </header>
      {data?.mode === 'mock' && <p className={styles.notice}>模拟设备预览 · 所有操作与正式设备隔离</p>}
      {error && (
        <MaterialAlert severity="error" className={styles.error} role="alert">
          {error}
        </MaterialAlert>
      )}
      {!data ? (
        <p className={styles.empty}>{error ? '设备服务暂时不可用' : '正在连接设备管理服务…'}</p>
      ) : (
        <>
          <section className={styles.summary}>
            <div>
              <strong>{data.devices.filter((device) => device.status === 'free').length}</strong>
              <span>可用设备</span>
            </div>
            <div>
              <strong>{data.leases.length}</strong>
              <span>使用会话</span>
            </div>
            <div>
              <strong>{data.queue.length}</strong>
              <span>排队会话</span>
            </div>
          </section>
          <form
            className={styles.acquire}
            onSubmit={(event) => {
              event.preventDefault()
              void act(() => acquireDevices(platform === 'both' ? ['android', 'ios'] : [platform as Platform], reason))
            }}
          >
            <SelectInput
              aria-label="申请平台"
              value={platform}
              onChange={(event) => setPlatform(event.target.value)}
              disabled={busy || Boolean(own) || waiting}
            >
              <option value="both">Android + iOS</option>
              <option value="android">Android</option>
              <option value="ios">iOS</option>
            </SelectInput>
            <Input
              aria-label="使用用途"
              value={reason}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              placeholder="使用用途"
              disabled={busy || Boolean(own) || waiting}
            />
            {own ? (
              <Button variant="text" type="button" disabled={busy} onClick={() => void act(() => releaseDevices(own.id))}>
                释放我的设备
              </Button>
            ) : waiting ? (
              <Button variant="text" type="button" disabled={busy} onClick={() => void act(cancelDevices)}>
                取消排队
              </Button>
            ) : (
              <Button variant="text" type="submit" disabled={busy || !data.devices.length}>
                申请设备
              </Button>
            )}
          </form>
          {own && <p className={styles.hint}>手动租约空闲 15 分钟后回收。查看截图不会延长占用。</p>}
          {data.devices.length === 0 && <p className={styles.empty}>尚未初始化受管理设备。已有模拟器可只读查看，加入设备池需单独创建。</p>}
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
            <h2>排队</h2>
            {data.queue.length ? (
              <ol className={styles.queue}>
                {data.queue.map((item) => (
                  <li key={item.owner}>
                    <strong>{data.owners[item.owner]?.title || ownerName(item.owner)}</strong>
                    <span>
                      {item.platforms.join(' + ')} · {item.reason || '未填写用途'}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.hint}>没有等待中的申请</p>
            )}
          </section>
          <section className={styles.section}>
            <div className={styles.sectionTitle}>
              <h2>已有模拟器</h2>
              <Button
                variant="text"
                type="submit"
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    const result = await discoverDevices()
                    setData(result)
                  })
                }
              >
                <ExternalLink size={14} />
                只读发现
              </Button>
            </div>
            <p className={styles.hint}>这些设备不参与分配，也不会被清理或接管。</p>
            {data.observed.map((item) => (
              <div className={styles.observed} key={`${item.platform}-${item.target}`}>
                <span>{item.name}</span>
                <span>
                  {item.platform} · {item.state}
                </span>
              </div>
            ))}
            {data.discoveryErrors.map((text) => (
              <p className={styles.error} key={text}>
                {text}
              </p>
            ))}
          </section>
          <section className={styles.section}>
            <h2>操作记录</h2>
            <ul className={styles.events}>
              {[...data.events]
                .reverse()
                .slice(0, 30)
                .map((item, index) => (
                  <li key={`${item.time}-${index}`}>
                    <time>{moment(item.time)}</time>
                    <span>
                      {item.text}
                      {item.owner && <small>{data.owners[item.owner]?.title || ownerName(item.owner)}</small>}
                    </span>
                  </li>
                ))}
            </ul>
          </section>
          <footer className={styles.hint}>独立设备管理服务 · 启动于 {moment(data.startedAt)}</footer>
        </>
      )}
    </div>
  )
}
function DeviceCard({
  device,
  data,
  ctx,
  busy,
  act,
}: {
  device: Device
  data: DevicesSnapshot
  ctx: WindowContext
  busy: boolean
  act: (operation: () => Promise<unknown>) => Promise<void>
}) {
  const [capture, setCapture] = useState<Awaited<ReturnType<typeof captureDevice>>>()
  const lease = data.leases.find((item) => item.devices.includes(device.id))
  const session = lease && data.owners[lease.owner]
  return (
    <Card component="article" className={styles.card}>
      <div className={styles.cardTitle}>
        <Smartphone size={22} />
        <div>
          <h2>{device.name}</h2>
          <p>
            {device.system?.replace('com.apple.CoreSimulator.SimRuntime.', '').replaceAll('-', '.') ??
              (device.platform === 'ios' ? 'iOS' : 'Android')}
          </p>
        </div>
        <Chip
          size="small"
          color={device.status === 'broken' ? 'error' : device.status === 'free' ? 'primary' : 'secondary'}
          label={labels[device.status]}
        />
      </div>
      {capture ? (
        <img className={styles.screenshot} src={`data:${capture.mime};base64,${capture.image}`} alt={`${device.name} 屏幕截图`} />
      ) : (
        <div className={styles.placeholder}>
          <Smartphone size={44} />
          <span>按需查看设备画面</span>
        </div>
      )}
      {capture && <p className={styles.hint}>截图于 {moment(capture.at)} · 非实时画面</p>}
      <dl className={styles.details}>
        <div>
          <dt>设备</dt>
          <dd>{device.id}</dd>
        </div>
        <div>
          <dt>占用</dt>
          <dd>
            {session && ctx.openApplication ? (
              <Button variant="text" type="submit" onClick={() => ctx.openApplication?.('code', `/${session.session}`)}>
                {session.title || `会话 ${session.session}`}
              </Button>
            ) : lease ? (
              ownerName(lease.owner)
            ) : (
              '无'
            )}
          </dd>
        </div>
        {lease && (
          <>
            <div>
              <dt>用途</dt>
              <dd>{lease.reason || '未填写'}</dd>
            </div>
            <div>
              <dt>开始</dt>
              <dd>{moment(lease.createdAt)}</dd>
            </div>
          </>
        )}
      </dl>
      {device.error && <p className={styles.error}>{device.error}</p>}
      <div className={styles.actions}>
        <Button
          variant="text"
          type="submit"
          disabled={busy || device.status === 'cleaning' || device.status === 'broken'}
          onClick={() => void act(async () => setCapture(await captureDevice(device.id)))}
        >
          <Camera size={15} />
          截图
        </Button>
        {!lease && device.status !== 'cleaning' && (
          <Button
            variant="text"
            type="submit"
            disabled={busy}
            onClick={() => void act(() => controlDevice(device.id, device.status === 'free' ? 'maintenance' : 'restore'))}
          >
            {device.status === 'free' ? <Wrench size={15} /> : <Play size={15} />}
            {device.status === 'free' ? '维护' : '恢复并清理'}
          </Button>
        )}
        {lease && (
          <Button variant="text" type="submit" disabled={busy} onClick={() => void act(() => releaseDevices(lease.id))}>
            释放租约
          </Button>
        )}
      </div>
    </Card>
  )
}

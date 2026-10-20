import type { MonitorStatus, Probe, Sample, Snapshot, Thresholds } from '@binos/server/apps/system/types'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { disableNotifications, enableNotifications, notificationsEnabled, refreshMonitor, systemRequest, systemUrl } from './monitor.ts'
import { bytes, moment } from './format.ts'
import styles from './Monitor.module.css'

const duration = (seconds: number) => `${Math.floor(seconds / 86400)} 天 ${Math.floor((seconds % 86400) / 3600)} 时 ${Math.floor((seconds % 3600) / 60)} 分`
const percent = (value: number | null) => (value === null ? '采样中' : `${value.toFixed(1)}%`)
const pressureNames = { normal: '正常', warning: '警告', critical: '严重', unknown: '未知' }

export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <header>
        <h2>{title}</h2>
        {hint && <p>{hint}</p>}
      </header>
      {children}
    </section>
  )
}
export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.row}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
export function ProbeDetails({ probes }: { probes: Probe[] }) {
  return (
    <div className={styles.probes}>
      {probes.map((probe) => (
        <details key={probe.id} className={styles.probe}>
          <summary>
            <span>{probe.label}</span>
            <small className={probe.error ? styles.bad : ''}>
              {probe.error ? '不可确认' : '已采集'} · {new Date(probe.at).toLocaleTimeString('zh-CN')}
            </small>
          </summary>
          <pre>{probe.error || probe.text || '未返回信息'}</pre>
        </details>
      ))}
    </div>
  )
}
function Stat({ label, value, note, tone }: { label: string; value: string; note: string; tone?: string }) {
  return (
    <article className={styles.stat} data-tone={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  )
}
function Chart({
  title,
  samples,
  field,
  unit = 'percent',
}: {
  title: string
  samples: Sample[]
  field: keyof Omit<Sample, 'at'>
  unit?: 'percent' | 'bytes' | 'rate'
}) {
  const present = samples.filter((item) => item[field] !== null)
  const max = unit === 'percent' ? 100 : Math.max(1, ...present.map((s) => s[field]!)) * 1.1
  const start = samples[0]?.at || 0
  const end = Math.max(start + 60_000, samples.at(-1)?.at || start)
  let previous = 0
  let path = ''
  for (const sample of samples) {
    const value = sample[field]
    if (value === null) {
      previous = 0
      continue
    }
    const x = ((sample.at - start) / (end - start)) * 600
    const y = 90 - Math.min(1, value / max) * 80
    path += `${!previous || sample.at - previous > 120_000 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)} `
    previous = sample.at
  }
  const format = (value: number) => (unit === 'percent' ? `${value.toFixed(0)}%` : bytes(value) + (unit === 'rate' ? '/s' : ''))
  return (
    <article className={styles.chart}>
      <header>
        <strong>{title}</strong>
        <span>{present.length ? format(present.at(-1)![field]!) : '等待采样'}</span>
      </header>
      <svg viewBox="0 0 600 100" role="img" aria-label={title + '时间趋势'} preserveAspectRatio="none">
        <path d="M0 10H600 M0 50H600 M0 90H600" className={styles.gridLine} />
        <path d={path} className={styles.chartLine} />
      </svg>
      <footer>
        <span>{samples.length ? new Date(start).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '尚无历史'}</span>
        <span>{format(max)} 上界</span>
        <span>现在</span>
      </footer>
    </article>
  )
}
function useHistory() {
  const [samples, setSamples] = useState<Sample[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    const read = () =>
      void systemRequest<{ samples: Sample[] }>('/history')
        .then((data) => {
          if (!cancelled) {
            setSamples(data.samples)
            setError('')
          }
        })
        .catch(() => {
          if (!cancelled) setError('历史记录加载失败')
        })
    read()
    const timer = setInterval(read, 60_000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])
  return { samples, error }
}
export function HostMonitor({ status, tab }: { status: MonitorStatus; tab: string }) {
  const snapshot = status.snapshot
  const { samples, error } = useHistory()
  if (!snapshot) return <p className={styles.empty}>正在首次采集宿主信息…</p>
  const source = (ids: string[]) => snapshot.probes.filter((probe) => ids.includes(probe.id))
  const rates = snapshot.network.filter((n) => !n.internal)
  const receive = rates.some((n) => n.receiveRate !== null) ? rates.reduce((a, n) => a + (n.receiveRate || 0), 0) : null
  const send = rates.some((n) => n.sendRate !== null) ? rates.reduce((a, n) => a + (n.sendRate || 0), 0) : null
  const disk = snapshot.volumes.find((v) => v.mount === '/System/Volumes/Data') || snapshot.volumes.find((v) => v.mount === '/')
  const live: Sample = {
    at: snapshot.at,
    cpu: snapshot.cpu.percent,
    memory: 100 * (1 - snapshot.memory.free / snapshot.memory.total),
    swap: snapshot.memory.swap,
    available: disk?.available ?? null,
    receive,
    send,
  }
  const chartSamples = [...samples.filter((s) => s.at < live.at), live]
  const active = status.alerts.filter((a) => !a.resolved)
  return (
    <div className={styles.content}>
      {tab === 'overview' && (
        <>
          <div className={styles.hero}>
            <div>
              <span className={styles.eyebrow}>HOST MAC</span>
              <h1>{snapshot.host.name}</h1>
              <p>
                {snapshot.host.chip} · {snapshot.host.model} · {snapshot.host.cores} 核 · {bytes(snapshot.memory.total)}
              </p>
            </div>
            <span className={styles.badge} data-tone={active.some((a) => a.severity === 'critical') ? 'critical' : active.length ? 'warning' : 'ok'}>
              {active.length ? `${active.length} 项待检查` : '已采集项目未触发告警'}
            </span>
          </div>
          <div className={styles.stats}>
            <Stat label="CPU 总使用率" value={percent(snapshot.cpu.percent)} note={`负载 ${snapshot.cpu.load.map((n) => n.toFixed(2)).join(' / ')}`} />
            <Stat
              label="内存压力"
              value={pressureNames[snapshot.memory.pressure]}
              note={`交换空间 ${bytes(snapshot.memory.swap)}`}
              tone={snapshot.memory.pressure}
            />
            <Stat label="启动磁盘可用" value={bytes(disk?.available)} note={disk ? `共享容量 ${bytes(disk.total)}` : '磁盘采集不可用'} />
            <Stat label="连续运行" value={duration(snapshot.host.uptime)} note={`启动于 ${moment(snapshot.host.boot)}`} />
          </div>
          {active.length > 0 && (
            <Section title="当前告警" hint="确认仅表示已读，不会消除异常。详情及阈值见「告警」。">
              <AlertList alerts={active.slice(0, 5)} />
            </Section>
          )}
          <div className={styles.charts}>
            <Chart title="CPU 使用率" samples={chartSamples} field="cpu" />
            <Chart title="已分配物理内存（含缓存）" samples={chartSamples} field="memory" />
          </div>
          {error && (
            <p role="alert" className={styles.bad}>
              {error}
            </p>
          )}
          <Section title="远程可用性">
            <dl>
              <Row label="供电">
                {snapshot.power.source} {snapshot.power.battery !== null ? `· ${snapshot.power.battery}%` : '· 无电池数据'}
              </Row>
              <Row label="系统热报告">
                {snapshot.power.thermalWarning === null
                  ? '系统未提供可判断的热状态；无温度传感器读数'
                  : snapshot.power.thermalWarning
                    ? '报告热限制'
                    : '未报告热限制（不代表温度读数）'}
              </Row>
              <Row label="互联网">{source(['internet'])[0]?.error || source(['internet'])[0]?.text || '等待探测'}</Row>
              <Row label="采集策略">资源约每 5 秒，诊断与服务约每 60 秒；命令超时会延长周期</Row>
              <Row label="历史保留">每分钟一个资源快照，保留 24 小时；已恢复事件最多 300 条</Row>
            </dl>
          </Section>
          <p className={styles.note}>
            监控随 binOS 后端持续采集，不依赖此页面打开。图表留空代表没有采样，不能据此判断主机当时是否正常。浏览器通知依赖 binOS
            网页仍在运行；断电、断网、整机卡死的可靠站外告警需要另一台设备上的独立监测。
          </p>
        </>
      )}
      {tab === 'resources' && (
        <>
          <Section title="CPU" hint="总使用率按全部逻辑核心归一为 100%；进程表的 100% 则表示占用一个核心。">
            <dl>
              <Row label="芯片">{snapshot.host.chip}</Row>
              <Row label="总使用率">{percent(snapshot.cpu.percent)}</Row>
              <Row label="负载（1 / 5 / 15 分钟）">{snapshot.cpu.load.map((n) => n.toFixed(2)).join(' / ')}</Row>
            </dl>
            <div className={styles.cores}>
              {snapshot.cpu.cores.map((value, i) => (
                <div key={i} title={`逻辑核心 ${i + 1}`}>
                  <span>#{i + 1}</span>
                  <meter min={0} max={100} value={value || 0} />
                  <small>{percent(value)}</small>
                </div>
              ))}
            </div>
          </Section>
          <Section title="内存" hint="macOS 会使用空闲内存作缓存。告警以系统内存压力为准，不以“已分配百分比”判断。">
            <dl>
              <Row label="系统内存压力">{pressureNames[snapshot.memory.pressure]}</Row>
              <Row label="物理内存">{bytes(snapshot.memory.total)}</Row>
              <Row label="空闲">{bytes(snapshot.memory.free)}</Row>
              <Row label="文件缓存">{bytes(snapshot.memory.cached)}</Row>
              <Row label="联结内存（wired）">{bytes(snapshot.memory.wired)}</Row>
              <Row label="压缩器占用">{bytes(snapshot.memory.compressed)}</Row>
              <Row label="交换空间已用">{bytes(snapshot.memory.swap)}</Row>
            </dl>
          </Section>
          <div className={styles.charts}>
            <Chart title="CPU 使用率" samples={chartSamples} field="cpu" />
            <Chart title="已分配物理内存（含缓存）" samples={chartSamples} field="memory" />
            <Chart title="交换空间" samples={chartSamples} field="swap" unit="bytes" />
          </div>
          <ProbeDetails probes={source(['vm', 'swap', 'pressure', 'thermal'])} />
        </>
      )}
      {tab === 'storage' && (
        <>
          <Section title="已挂载文件系统" hint="APFS 卷共享容器空间；不要把各卷容量相加。使用率按总容量与可用空间估算。">
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>挂载点</th>
                    <th>容量</th>
                    <th>可用</th>
                    <th>已用比例</th>
                    <th>设备</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.volumes.map((v) => (
                    <tr key={v.filesystem + v.mount}>
                      <td className={styles.path}>{v.mount}</td>
                      <td>{bytes(v.total)}</td>
                      <td>{bytes(v.available)}</td>
                      <td>{v.total ? `${(100 * (1 - v.available / v.total)).toFixed(1)}%` : '—'}</td>
                      <td>{v.filesystem}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
          <Chart title="启动磁盘可用空间" samples={chartSamples} field="available" unit="bytes" />
          <ProbeDetails probes={source(['volumes', 'smart', 'backup', 'backupState'])} />
        </>
      )}
      {tab === 'network' && (
        <>
          <Section title="网络接口" hint="速率来自相邻采样的字节计数差。VPN、桥接等虚拟接口可能与物理接口重复计数；收发计数自系统启动或接口重置起累计。">
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>接口 / 地址</th>
                    <th>接收 /s</th>
                    <th>发送 /s</th>
                    <th>累计接收</th>
                    <th>累计发送</th>
                    <th>错误计数</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.network.map((n) => (
                    <tr key={n.name}>
                      <td>
                        <strong>{n.name}</strong>
                        {n.internal && ' · 回环'}
                        <small className={styles.address}>{n.addresses.join('\n') || '无地址'}</small>
                      </td>
                      <td>{bytes(n.receiveRate)}</td>
                      <td>{bytes(n.sendRate)}</td>
                      <td>{bytes(n.received)}</td>
                      <td>{bytes(n.sent)}</td>
                      <td>{n.errors ?? '未知'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
          <div className={styles.charts}>
            <Chart title="接口合计接收（可能重复计数）" samples={chartSamples} field="receive" unit="rate" />
            <Chart title="接口合计发送（可能重复计数）" samples={chartSamples} field="send" unit="rate" />
          </div>
          <ProbeDetails probes={source(['internet', 'route', 'dns', 'listeners', 'traffic'])} />
        </>
      )}
      {tab === 'processes' && <Processes snapshot={snapshot} />}
      {tab === 'power' && <Power status={status} probes={source(['power', 'batteryHealth', 'thermal', 'sleep', 'assertions', 'schedule'])} />}
      {tab === 'diagnostics' && (
        <>
          <Section title="宿主信息">
            <dl>
              <Row label="主机名">{snapshot.host.name}</Row>
              <Row label="型号 / 架构">
                {snapshot.host.model} / {snapshot.host.arch}
              </Row>
              <Row label="系统">{snapshot.host.os}</Row>
              <Row label="Darwin 内核">{snapshot.host.kernel}</Row>
              <Row label="开机时间">{moment(snapshot.host.boot)}</Row>
              <Row label="连续运行">{duration(snapshot.host.uptime)}</Row>
            </dl>
          </Section>
          <Section
            title="安全、备份与异常记录"
            hint="这些项目只读取状态。系统权限、工具不可用或备份目标离线时会显示不可确认。诊断报告只列名称和时间，不读取报告正文。"
          >
            <ProbeDetails probes={source(['filevault', 'sip', 'gatekeeper', 'firewall', 'backup', 'backupState', 'reboots', 'crashes', 'identity', 'users'])} />
          </Section>
          <Section title="采集覆盖" hint="每个来源显示自己的更新时间；不可确认与未触发告警是两种不同状态。">
            <ProbeDetails probes={snapshot.probes} />
          </Section>
        </>
      )}
      {tab === 'alerts' && <Alerts status={status} />}
    </div>
  )
}
function Processes({ snapshot }: { snapshot: Snapshot }) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('cpu')
  const processes = snapshot.processes
    .filter((p) => `${p.pid} ${p.name}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    .sort((a, b) => (sort === 'memory' ? b.memory - a.memory : b.cpu - a.cpu))
  return (
    <Section
      title="进程"
      hint={`全机 ${snapshot.processCount} 个进程。显示 CPU、内存各前 100 名的去重结果；完整列表见下方原始进程数据。RSS 含共享页，不能相加得到物理内存占用。CPU 为 ps 的近期统计，可能超过 100%。`}
    >
      <div className={styles.actions}>
        <input aria-label="搜索进程" placeholder="搜索进程名或 PID" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select aria-label="进程排序" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="cpu">按 CPU</option>
          <option value="memory">按内存</option>
        </select>
      </div>
      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>进程</th>
              <th>PID / PPID</th>
              <th>CPU</th>
              <th>RSS 内存</th>
              <th>运行时间</th>
            </tr>
          </thead>
          <tbody>
            {processes.map((p) => (
              <tr key={p.pid}>
                <td className={styles.path} title={p.name}>
                  {p.name.split('/').pop()}
                  <small className={styles.address}>{p.name}</small>
                </td>
                <td>
                  {p.pid} / {p.parent}
                </td>
                <td>{p.cpu.toFixed(1)}%</td>
                <td>{bytes(p.memory)}</td>
                <td>{p.elapsed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ProbeDetails probes={snapshot.probes.filter((p) => p.id === 'processes')} />
    </Section>
  )
}
function Power({ status, probes }: { status: MonitorStatus; probes: Probe[] }) {
  const [hours, setHours] = useState(8)
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const act = async (value: number) => {
    setBusy(true)
    setError('')
    try {
      await systemRequest('/awake', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hours: value }) })
      setConfirm(false)
      await refreshMonitor()
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <Section
        title="临时保持唤醒"
        hint="使用 caffeinate 阻止空闲休眠，不修改 pmset 配置、不保持屏幕常亮。到期或当前 binOS 后端退出后释放；不能抵御断电、强制睡眠或笔记本合盖。上线重启也会结束此操作。"
      >
        <dl>
          <Row label="状态">{status.keepAwakeUntil ? `保持至 ${moment(status.keepAwakeUntil)}` : '未启用'}</Row>
        </dl>
        <div className={styles.actions}>
          <select
            aria-label="保持唤醒时长"
            value={hours}
            onChange={(e) => {
              setHours(Number(e.target.value))
              setConfirm(false)
            }}
          >
            <option value={1}>1 小时</option>
            <option value={8}>8 小时</option>
            <option value={24}>24 小时</option>
          </select>
          <button disabled={busy} onClick={() => setConfirm(true)}>
            保持唤醒…
          </button>
          {status.keepAwakeUntil && (
            <button disabled={busy} onClick={() => void act(0)}>
              停止保持唤醒
            </button>
          )}
        </div>
        {confirm && (
          <div className={styles.warning}>
            确认让宿主在接下来 {hours} 小时内避免空闲休眠？可能增加耗电。
            <div className={styles.actions}>
              <button disabled={busy} onClick={() => void act(hours)}>
                确认保持唤醒
              </button>
              <button onClick={() => setConfirm(false)}>取消</button>
            </div>
          </div>
        )}
        {error && (
          <p role="alert" className={styles.bad}>
            {error}
          </p>
        )}
      </Section>
      <ProbeDetails probes={probes} />
    </>
  )
}
function AlertList({ alerts }: { alerts: MonitorStatus['alerts'] }) {
  const [error, setError] = useState('')
  const acknowledge = async (id: string) => {
    try {
      await systemRequest(`/alerts/${id}/acknowledge`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      await refreshMonitor()
    } catch (e) {
      setError(String(e))
    }
  }
  return (
    <>
      {alerts.map((a) => (
        <article key={a.id} className={styles.alert} data-tone={a.resolved ? 'resolved' : a.severity}>
          <div>
            <strong>{a.title}</strong>
            <span>
              {a.resolved ? '已恢复 / 已记录' : a.severity === 'critical' ? '严重' : '警告'}
              {a.acknowledged ? ' · 已确认' : ''}
            </span>
          </div>
          <p>{a.detail}</p>
          <footer>
            <span>
              {moment(a.started)}
              {a.resolved ? ` → ${moment(a.resolved)}` : ''}
            </span>
            {!a.acknowledged && <button onClick={() => void acknowledge(a.id)}>确认已读</button>}
          </footer>
        </article>
      ))}
      {error && (
        <p className={styles.bad} role="alert">
          {error}
        </p>
      )}
    </>
  )
}
function Alerts({ status }: { status: MonitorStatus }) {
  const [showResolved, setShowResolved] = useState(false)
  const [notificationError, setNotificationError] = useState('')
  const active = status.alerts.filter((a) => !a.resolved)
  return (
    <>
      <Section title="通知与监控边界">
        <div className={styles.actions}>
          <button
            onClick={() => {
              setNotificationError('')
              if (notificationsEnabled()) disableNotifications()
              else void enableNotifications().catch((e) => setNotificationError(String(e)))
            }}
          >
            {notificationsEnabled() ? '关闭浏览器通知' : '开启桌面浏览器通知'}
          </button>
          <a href={systemUrl + '/report'}>导出诊断报告</a>
        </div>
        {notificationError && (
          <p role="alert" className={styles.bad}>
            {notificationError}
          </p>
        )}
        <p className={styles.note}>
          告警采集在后端运行，浏览器通知只在 binOS
          网页仍运行、浏览器允许后台运行且支持通知时生效。手机浏览器可能不支持。当前没有配置站外通知。整机断电、断网或卡死，需要独立于这台 Mac
          的外部可用性监测才能可靠告知；系统内监控不能保证送达。
        </p>
        <p className={styles.note}>报告包含主机信息、网络地址、进程及诊断输出，请妥善保管。</p>
      </Section>
      <Section title={`当前告警 · ${active.length}`} hint="资源类告警需持续达到条件，避免瞬时波动；恢复自动记录。安全设置和备份不可确认会立即提示。">
        {active.length ? <AlertList alerts={active} /> : <p className={styles.note}>已采集项目未触发告警。请同时留意诊断页中的不可确认项。</p>}
      </Section>
      <Section title="事件记录">
        <label className={styles.checkbox}>
          <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
          显示已恢复事件
        </label>
        <AlertList alerts={status.alerts.filter((a) => a.resolved && (showResolved || !a.acknowledged))} />
      </Section>
      <Section title="告警阈值">
        <ThresholdForm key={JSON.stringify(status.thresholds)} settings={status.thresholds} />
      </Section>
    </>
  )
}
function ThresholdForm({ settings }: { settings: Thresholds }) {
  const [value, setValue] = useState(settings)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const fields: [keyof Thresholds, string, number, number][] = [
    ['cpu', 'CPU 使用率阈值（%）', 10, 100],
    ['cpuSeconds', 'CPU 持续时间（秒）', 15, 3600],
    ['diskFreeGB', '可用空间低于（GiB）', 1, 1000],
    ['diskFreePercent', '或可用比例低于（%）', 1, 50],
    ['battery', '电池电量低于（%）', 5, 90],
  ]
  return (
    <form
      className={styles.settings}
      onSubmit={(e) => {
        e.preventDefault()
        setBusy(true)
        setMessage('')
        void systemRequest('/thresholds', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) })
          .then(async () => {
            setMessage('已保存')
            await refreshMonitor()
          })
          .catch((error) => setMessage(String(error)))
          .finally(() => setBusy(false))
      }}
    >
      {fields.map(([key, label, min, max]) => (
        <label key={key}>
          <span>{label}</span>
          <input
            aria-label={label}
            type="number"
            min={min}
            max={max}
            required
            value={value[key]}
            onChange={(e) => setValue({ ...value, [key]: Number(e.target.value) })}
          />
        </label>
      ))}
      <p className={styles.note}>
        内存使用系统压力级别；热限制、服务退出、互联网探测失败、备份不可确认和部分安全配置另有固定规则。磁盘只告警启动卷与 /Volumes 下的卷，共享容量去重。
      </p>
      <div className={styles.actions}>
        <button disabled={busy}>保存阈值</button>
        <span role="status">{message}</span>
      </div>
    </form>
  )
}

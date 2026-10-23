import { useCallback, useEffect, useState } from 'react'
import type { Build, Snapshot, Target } from '@binos/server/apps/builds/types'
import { CheckCircleFillIcon, DotFillIcon, DownloadIcon, StopIcon, SyncIcon, WorkflowIcon, XCircleFillIcon } from '@primer/octicons-react'
import { Alert } from '../../ui/Alert.tsx'
import { Checkbox } from '../../ui/Checkbox.tsx'
import { Button, LinkButton } from '../../ui/Button.tsx'
import { Blankslate } from '../../ui/Blankslate.tsx'
import { Label } from '../../ui/Label.tsx'
import { SegmentedControl } from '../../ui/SegmentedControl.tsx'
import { Select } from '../../ui/Select.tsx'
import { Spinner } from '../../ui/Spinner.tsx'
import { TextInput } from '../../ui/TextInput.tsx'
import styles from './BuildsPage.module.css'
const base = '/api/apps/builds'
const targetLabels: Record<Target, string> = { android: 'Android APK', 'ios-simulator': 'iOS 模拟器', 'ios-adhoc': 'iOS Ad Hoc' }
const statusLabels = { queued: '排队中', running: '构建中', success: '成功', failed: '失败', cancelled: '已取消', interrupted: '已中断' }
async function request(body?: unknown): Promise<Snapshot> {
  const r = await fetch(base, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined)
  const data = await r.json()
  if (!r.ok) throw new Error(data.error ?? '请求失败')
  return data
}
export function BuildsPage({ initialRef = 'main' }: { initialRef?: string }) {
  const [data, setData] = useState<Snapshot>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [ref, setRef] = useState(initialRef)
  const [target, setTarget] = useState('both')
  const [filter, setFilter] = useState('all')
  const [log, setLog] = useState<Build>()
  const [text, setText] = useState('')
  const [clock, setClock] = useState(() => Date.now())
  const load = useCallback(async () => { try { setData(await request()); setClock(Date.now()); setError('') } catch (e) { setError(String(e)) } }, [])
  useEffect(() => { const initial = setTimeout(() => void load(), 0); const timer = setInterval(() => { if (!document.hidden) void load() }, 4000); return () => { clearTimeout(initial); clearInterval(timer) } }, [load])
  useEffect(() => {
    if (!log) return
    let active = true
    const read = async () => { try { const r = await fetch(`${base}/${log.id}/log`); if (!r.ok) throw new Error('日志读取失败'); const value = await r.text(); if (active) setText(value) } catch (e) { if (active) setText(String(e)) } }
    void read(); const timer = setInterval(() => void read(), 2000)
    return () => { active = false; clearInterval(timer) }
  }, [log])
  async function install(id: string) {
    setBusy(true)
    try {
      const r = await fetch(`${base}/${id}/install`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      const value = await r.json()
      if (!r.ok) throw new Error(value.error ?? '无法创建安装链接')
      window.location.assign(value.url)
    } catch (e) { setError(String(e)) } finally { setBusy(false) }
  }
  async function act(body: unknown) { setBusy(true); try { setData(await request(body)); setError('') } catch (e) { setError(String(e)) } finally { setBusy(false) } }
  return <section className={styles.page}>
    <header className={styles.subhead}>
      <div><h2>构建</h2><p>Android 与 iOS 的持续集成、日志和产物</p></div>
      <Button leadingVisual={SyncIcon} disabled={busy} onClick={() => void act({ action: 'poll' })}>检查更新</Button>
    </header>
    {data?.mode === 'mock' && <Alert variant="info" className={styles.banner}>预览模式：模拟构建，与正式构建及签名隔离。</Alert>}
    {error && <Alert className={styles.banner}>{error}</Alert>}
    {data?.pollError && <Alert className={styles.banner}>检查仓库失败：{data.pollError}</Alert>}
    {data && <div className={styles.settings}>
      <Checkbox label="自动构建 main 和 PR" checked={data.settings.automatic} disabled={busy} onCheckedChange={(checked) => void act({ action: 'settings', ...data.settings, automatic: checked })} />
      <Checkbox label="自动构建 Ad Hoc" caption="需要签名证书及已注册设备" checked={data.settings.adhoc} disabled={busy} onCheckedChange={(checked) => void act({ action: 'settings', ...data.settings, adhoc: checked })} />
      {data.checkedAt && <small className={styles.caption}>上次检查：{new Date(data.checkedAt).toLocaleString()}</small>}
    </div>}
    <form className={styles.enqueue} onSubmit={(e) => { e.preventDefault(); void act({ action: 'enqueue', ref: ref.trim(), targets: target === 'both' ? ['android', 'ios-simulator'] : [target] }) }}>
      <label className={styles.field}><span>构建来源</span><TextInput block aria-label="构建来源" required value={ref} onChange={(e) => setRef(e.target.value)} placeholder="main、pr/编号、完整提交号" /></label>
      <div className={styles.field}><span>构建目标</span><Select size="medium" label="构建目标" value={target} onValueChange={setTarget} options={[{ value: 'both', label: 'Android + iOS 模拟器' }, ...Object.entries(targetLabels).map(([key, label]) => ({ value: key, label }))]} /></div>
      <Button variant="primary" disabled={busy || !data} type="submit">开始构建</Button>
    </form>
    <div className={styles.toolbar}>
      <SegmentedControl label="构建筛选" size="small" value={filter} onChange={setFilter} segments={[['all', '全部'], ['main', 'main'], ['pr', 'PR'], ['manual', '手动']].map(([value, label]) => ({ value, label }))} />
    </div>
    {!data ? <p className={styles.loading}><Spinner />正在连接构建服务…</p> : !data.builds.length ? <div className={styles.box}><Blankslate icon={WorkflowIcon} size="narrow" heading="暂无构建" description="提交包含移动端构建脚本后将自动构建，也可以手动指定来源。" /></div> : <div className={styles.box}>{data.builds.filter((b) => filter === 'all' || b.trigger === filter).map((b) => <article key={b.id} className={styles.run}>
      <span className={styles.status} data-status={b.status} title={statusLabels[b.status]}>{b.status === 'running' ? <Spinner /> : b.status === 'success' ? <CheckCircleFillIcon size={16} /> : b.status === 'failed' ? <XCircleFillIcon size={16} /> : b.status === 'queued' ? <DotFillIcon size={16} /> : <StopIcon size={16} />}</span>
      <div className={styles.main}>
        <div className={styles.title}><strong>{targetLabels[b.target]}</strong><Label>{b.trigger === 'pr' ? `PR #${b.pr}` : b.trigger === 'manual' ? '手动' : 'main'}</Label></div>
        <p className={styles.meta}><span data-status={b.status}>{statusLabels[b.status]}</span><code title={b.commit}>{b.commit.slice(0, 7)}</code><span>{new Date(b.createdAt).toLocaleString()}{b.startedAt && ` · 用时 ${Math.max(0, Math.round(((b.endedAt ? Date.parse(b.endedAt) : clock) - Date.parse(b.startedAt)) / 1000))} 秒`}</span></p>
        {b.error && <p className={styles.error}>{b.error}</p>}
        {data.mode === 'real' && b.target === 'ios-adhoc' && b.status === 'success' && <div className={styles.install}><Button size="small" disabled={busy} onClick={() => void install(b.id)}>在 iPhone / iPad 上安装</Button><small>仅限描述文件内已注册的设备，安装链接有效期 24 小时</small></div>}
        {b.artifacts.length > 0 && <ul className={styles.artifacts}>{b.artifacts.map((a) => <li key={a.name}><a href={`${base}/${b.id}/artifacts/${encodeURIComponent(a.name)}`} download title={`SHA-256: ${a.sha256}`}><DownloadIcon size={16} /><span>{a.name}</span><small>{(a.size / 1024 / 1024).toFixed(1)} MB</small></a></li>)}</ul>}
      </div>
      <div className={styles.actions}><Button size="small" onClick={() => { setText('读取日志…'); setLog(b) }}>查看日志</Button>{['queued', 'running'].includes(b.status) ? <Button size="small" variant="danger" disabled={busy} onClick={() => void act({ action: 'cancel', id: b.id })}>取消</Button> : <Button size="small" disabled={busy} onClick={() => void act({ action: 'retry', id: b.id })}>重新构建</Button>}</div>
    </article>)}</div>}
    {log && <section className={styles.log} aria-label="构建日志"><header><strong>{targetLabels[log.target]} · <code>{log.commit.slice(0, 7)}</code></strong><LinkButton size="small" leadingVisual={DownloadIcon} href={`${base}/${log.id}/log?download=1`} download>下载完整日志</LinkButton><Button size="small" onClick={() => setLog(undefined)}>关闭日志</Button></header><pre>{text}</pre></section>}
  </section>
}

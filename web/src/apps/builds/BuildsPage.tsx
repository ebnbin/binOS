import { useCallback, useEffect, useState } from 'react'
import type { Build, Snapshot, Target } from '@binos/server/apps/builds/types'
import { Select } from '../../ui/Select.tsx'
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
      window.location.href = value.url
    } catch (e) { setError(String(e)) } finally { setBusy(false) }
  }
  async function act(body: unknown) { setBusy(true); try { setData(await request(body)); setError('') } catch (e) { setError(String(e)) } finally { setBusy(false) } }
  return <section className={styles.page}>
    <header className={styles.header}><div><h1>构建</h1><p>Android 与 iOS 的持续集成、日志和产物</p></div><button className={styles.button} disabled={busy} onClick={() => void act({ action: 'poll' })}>检查更新</button></header>
    {data?.mode === 'mock' && <p className={styles.notice}>预览模式：模拟构建，与正式构建及签名隔离。</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {data?.pollError && <p role="alert" className={styles.error}>检查仓库失败：{data.pollError}</p>}
    {data && <div className={styles.group}>
      <div className={styles.list}>
        <label className={styles.switchRow}><span>自动构建 main 和 PR</span><input type="checkbox" role="switch" className={styles.switch} checked={data.settings.automatic} disabled={busy} onChange={(e) => void act({ action: 'settings', ...data.settings, automatic: e.target.checked })} /></label>
        <label className={styles.switchRow}><span>自动构建 Ad Hoc<small>需要签名证书及已注册设备</small></span><input type="checkbox" role="switch" className={styles.switch} checked={data.settings.adhoc} disabled={busy} onChange={(e) => void act({ action: 'settings', ...data.settings, adhoc: e.target.checked })} /></label>
      </div>
      {data.checkedAt && <small className={styles.hint}>上次检查：{new Date(data.checkedAt).toLocaleString()}</small>}
    </div>}
    <form className={styles.form} onSubmit={(e) => { e.preventDefault(); void act({ action: 'enqueue', ref: ref.trim(), targets: target === 'both' ? ['android', 'ios-simulator'] : [target] }) }}>
      <label className={styles.field}><span>构建来源</span><input className={styles.entry} aria-label="构建来源" required value={ref} onChange={(e) => setRef(e.target.value)} placeholder="main、pr/编号、完整提交号" /></label>
      <div className={styles.field}><span>构建目标</span><Select label="构建目标" value={target} onValueChange={setTarget} options={[{ value: 'both', label: 'Android + iOS 模拟器' }, ...Object.entries(targetLabels).map(([key, label]) => ({ value: key, label }))]} /></div>
      <button className={styles.primary} disabled={busy || !data} type="submit">开始构建</button>
    </form>
    <nav className={styles.filters} aria-label="构建筛选">{[['all', '全部'], ['main', 'main'], ['pr', 'PR'], ['manual', '手动']].map(([key, label]) => <button key={key} className={styles.toggle} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}</nav>
    {!data ? <p className={styles.empty}>正在连接构建服务…</p> : !data.builds.length ? <p className={styles.empty}>暂无构建。提交包含移动端构建脚本后将自动构建，也可以手动指定来源。</p> : <div className={styles.builds}>{data.builds.filter((b) => filter === 'all' || b.trigger === filter).map((b) => <article className={styles.build} key={b.id}>
      <div className={styles.row}><strong>{targetLabels[b.target]}</strong><span className={styles.status} data-status={b.status}>{statusLabels[b.status]}</span><code title={b.commit}>{b.commit.slice(0, 7)}</code><span className={styles.trigger}>{b.trigger === 'pr' ? `PR #${b.pr}` : b.trigger === 'manual' ? '手动' : 'main'}</span></div>
      <small className={styles.hint}>{new Date(b.createdAt).toLocaleString()}{b.startedAt && ` · 用时 ${Math.max(0, Math.round(((b.endedAt ? Date.parse(b.endedAt) : clock) - Date.parse(b.startedAt)) / 1000))} 秒`}</small>
      {b.error && <p className={styles.error}>{b.error}</p>}
      <div className={styles.row}><button className={styles.button} onClick={() => { setText('读取日志…'); setLog(b) }}>查看日志</button>{['queued', 'running'].includes(b.status) ? <button className={styles.button} disabled={busy} onClick={() => void act({ action: 'cancel', id: b.id })}>取消</button> : <button className={styles.button} disabled={busy} onClick={() => void act({ action: 'retry', id: b.id })}>重新构建</button>}</div>
      {data.mode === 'real' && b.target === 'ios-adhoc' && b.status === 'success' && <div className={styles.row}><button className={styles.primary} disabled={busy} onClick={() => void install(b.id)}>在 iPhone / iPad 上安装</button><small className={styles.hint}>仅限描述文件内已注册的设备，安装链接有效期 24 小时</small></div>}
      {b.artifacts.map((a) => <a className={styles.artifact} key={a.name} href={`${base}/${b.id}/artifacts/${encodeURIComponent(a.name)}`} download title={`SHA-256: ${a.sha256}`}>{a.name} · {(a.size / 1024 / 1024).toFixed(1)} MB ↓</a>)}
    </article>)}</div>}
    {log && <section className={styles.log} aria-label="构建日志"><header className={styles.logBar}><strong>{targetLabels[log.target]} · {log.commit.slice(0, 7)}</strong><a className={styles.flat} href={`${base}/${log.id}/log?download=1`} download>下载完整日志</a><button className={styles.flat} onClick={() => setLog(undefined)}>关闭日志</button></header><pre>{text}</pre></section>}
  </section>
}

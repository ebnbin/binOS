import { Activity, Bot, ChevronLeft, Monitor, RefreshCw } from '../../ui/icons'
import { useEffect, useState } from 'react'
import { IconButton } from '../../ui/IconButton.tsx'
import { Spinner } from '../../ui/Spinner.tsx'
import { useApplications } from '../index.ts'
import type { WindowContext } from '../types.ts'
import { AgentAccounts } from './AgentAccounts.tsx'
import { BinosMonitor } from './BinosMonitor.tsx'
import { HostMonitor } from './HostMonitor.tsx'
import { moment } from './format.ts'
import { refreshMonitor, systemRequest, useMonitor } from './monitor.ts'
import styles from './Monitor.module.css'

export function SystemApp({ ctx }: { ctx: WindowContext }) {
  const { status, error, lastSuccess, now } = useMonitor()
  const [refreshing, setRefreshing] = useState(false)
  const [actionError, setActionError] = useState('')
  const apps = useApplications().filter((app) => app.settings)
  const app = apps.find((item) => ctx.route === `/apps/${item.id}`)
  const section = ctx.route === '/agent' ? 'agent' : ctx.route.startsWith('/binos') || app ? 'binos' : 'host'

  const { setTitle } = ctx
  useEffect(() => setTitle(section === 'host' ? '宿主 Mac' : section === 'agent' ? 'Agent' : 'binOS'), [setTitle, section])
  const snapshot = status?.snapshot
  const stale = snapshot && now - snapshot.at > 30_000
  const refresh = async () => {
    setRefreshing(true)
    setActionError('')
    try {
      await systemRequest('/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      await refreshMonitor()
    } catch (e) {
      setActionError(String(e))
    } finally {
      setRefreshing(false)
    }
  }
  const Settings = app?.settings?.component
  const sections = [
    { id: 'host', name: '宿主 Mac', hint: '硬件与 macOS', icon: Monitor, route: '/' },
    { id: 'agent', name: 'Agent', hint: '账号与额度', icon: Bot, route: '/agent' },
    { id: 'binos', name: 'binOS', hint: '运行与维护', icon: Activity, route: '/binos' },
  ]
  const current = sections.find((item) => item.id === section)!
  const freshness = error ? '监控连接异常' : stale ? '数据已过期' : status?.collectionError ? '采集异常' : snapshot ? '正在监控' : '首次采集中'
  // Agent 页自带标题栏和刷新；其余页面共用这里的标题栏，副标题是监控的新鲜度
  return (
    <div className={styles.app}>
      <aside className={styles.sidebar}>
        <header className={styles.sidebarHeader}>
          <span className={styles.sidebarTitle}>系统</span>
        </header>
        <nav className={styles.sections} aria-label="系统分区">
          {sections.map((item) => (
            <button key={item.id} type="button" className={styles.section} aria-current={section === item.id ? 'page' : undefined} onClick={() => ctx.navigate(item.route)}>
              <item.icon />
              <span className={styles.sectionLabel}>
                {item.name}
                <small>{item.hint}</small>
              </span>
            </button>
          ))}
        </nav>
      </aside>
      <div className={styles.page}>
        {section !== 'agent' && (
          <header className={styles.top}>
            <span className={styles.start}>
              {Settings && <IconButton icon={ChevronLeft} label="返回" onClick={() => ctx.navigate('/binos')} />}
            </span>
            <div className={styles.title}>
              <strong>{Settings ? app!.name : current.name}</strong>
              <span className={styles.freshness} data-stale={!!error || stale || !!status?.collectionError}>
                {freshness}
                {snapshot && <small> · 采样 {new Date(snapshot.at).toLocaleTimeString('zh-CN')}</small>}
              </span>
            </div>
            <span className={styles.end}>
              <IconButton icon={RefreshCw} label="立即采集" disabled={refreshing} onClick={() => void refresh()} className={refreshing ? styles.spin : undefined} />
            </span>
          </header>
        )}
        {(error || stale || actionError) && (
          <div className={styles.warning} role="alert">
            {actionError || error || '监控采样超过 30 秒未更新'}。
            {error || stale ? `最后成功连接 ${moment(lastSuccess)}；保留的数据可能已过期，无法确认宿主当前正常。` : ''}
          </div>
        )}
        {status?.collectionError && (
          <div className={styles.warning} role="alert">
            {status.collectionError}
          </div>
        )}
        <div className={styles.body}>
          {section === 'agent' ? (
            <AgentAccounts back={() => ctx.navigate('/')} />
          ) : section === 'binos' ? (
            Settings ? (
              <Settings back={() => ctx.navigate('/binos')} />
            ) : (
              <BinosMonitor status={status} navigate={ctx.navigate} />
            )
          ) : status ? (
            <HostMonitor status={status} />
          ) : (
            <div className={styles.status}>
              {!error && <Spinner size={32} />}
              <p>{error ? '暂时无法读取宿主状态。页面会自动重试。' : '正在连接宿主监控…'}</p>
            </div>
          )}
        </div>
      </div>
      {/* 窄屏时侧栏收起，分区切换放到底部（AdwViewSwitcherBar） */}
      <nav className={styles.switcher} aria-label="系统分区">
        {sections.map((item) => (
          <button key={item.id} type="button" className={styles.switch} aria-current={section === item.id ? 'page' : undefined} onClick={() => ctx.navigate(item.route)}>
            <item.icon />
            <span>{item.name}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { AIMark, DeviceDesktop, Refresh, Settings as SettingsIcon } from '../../ui/icons.tsx'
import { IconButton } from '../../ui/IconButton.tsx'
import { InlineAlert } from '../../ui/InlineAlert.tsx'
import { ProgressCircle } from '../../ui/ProgressCircle.tsx'
import { StatusLight } from '../../ui/StatusLight.tsx'
import { useApplications } from '../index.ts'
import type { WindowContext } from '../types.ts'
import { AgentAccounts } from './AgentAccounts.tsx'
import { BinosMonitor } from './BinosMonitor.tsx'
import { HostMonitor } from './HostMonitor.tsx'
import { moment } from './format.ts'
import { refreshMonitor, systemRequest, useMonitor } from './monitor.ts'
import styles from './Monitor.module.css'

const sections = [
  { id: 'host', name: '宿主 Mac', hint: '硬件与 macOS', icon: DeviceDesktop, route: '/' },
  { id: 'agent', name: 'Agent', hint: '账号与额度', icon: AIMark, route: '/agent' },
  { id: 'binos', name: 'binOS', hint: '运行与维护', icon: SettingsIcon, route: '/binos' },
]

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
  const unhealthy = !!error || !!stale || !!status?.collectionError
  return (
    <div className={styles.app}>
      <div className={styles.layout}>
        <nav className={styles.nav} aria-label="系统分区">
          <h1 className={styles.navTitle}>系统</h1>
          {sections.map((item) => (
            <button
              key={item.id}
              type="button"
              className={styles.navItem}
              title={item.hint}
              aria-current={section === item.id ? 'page' : undefined}
              onClick={() => ctx.navigate(item.route)}
            >
              <item.icon size="M" />
              {item.name}
            </button>
          ))}
        </nav>
        <div className={styles.main}>
          <header className={styles.toolbar}>
            <StatusLight variant={unhealthy ? 'negative' : snapshot ? 'positive' : 'informative'}>
              {error ? '监控连接异常' : stale ? '数据已过期' : status?.collectionError ? '采集异常' : snapshot ? '正在监控' : '首次采集中'}
            </StatusLight>
            {snapshot && <span className={styles.sampled}>采样 {new Date(snapshot.at).toLocaleTimeString('zh-CN')}</span>}
            <IconButton
              icon={Refresh}
              label="立即采集"
              className={`${styles.refresh} ${refreshing ? styles.spinning : ''}`}
              disabled={refreshing}
              onClick={() => void refresh()}
            />
          </header>
          <div className={styles.body}>
            {(error || stale || actionError || status?.collectionError) && (
              <div className={styles.alerts}>
                {(error || stale || actionError) && (
                  <InlineAlert>
                    {actionError || error || '监控采样超过 30 秒未更新'}。
                    {error || stale ? `最后成功连接 ${moment(lastSuccess)}；保留的数据可能已过期，无法确认宿主当前正常。` : ''}
                  </InlineAlert>
                )}
                {status?.collectionError && <InlineAlert>{status.collectionError}</InlineAlert>}
              </div>
            )}
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
              <div className={styles.empty}>
                {!error && <ProgressCircle size="M" />}
                <p>{error ? '暂时无法读取宿主状态。页面会自动重试。' : '正在连接宿主监控…'}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

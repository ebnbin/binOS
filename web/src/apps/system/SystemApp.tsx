import { CopilotIcon, DeviceDesktopIcon, PulseIcon, SyncIcon } from '@primer/octicons-react'
import { useEffect, useState } from 'react'
import { useApplications } from '../index.ts'
import type { WindowContext } from '../types.ts'
import { AgentAccounts } from './AgentAccounts.tsx'
import { BinosMonitor } from './BinosMonitor.tsx'
import { HostMonitor } from './HostMonitor.tsx'
import { moment } from './format.ts'
import { refreshMonitor, systemRequest, useMonitor } from './monitor.ts'
import { Alert } from '../../ui/Alert.tsx'
import list from '../../ui/ActionList.module.css'
import { Blankslate } from '../../ui/Blankslate.tsx'
import { IconButton } from '../../ui/IconButton.tsx'
import { Label } from '../../ui/Label.tsx'
import { Spinner } from '../../ui/Spinner.tsx'
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
  const unhealthy = !!error || stale || !!status?.collectionError
  return (
    <div className={styles.app}>
      <header className={styles.top}>
        <h1>系统</h1>
        <Label variant={unhealthy ? 'danger' : snapshot ? 'success' : 'default'}>
          {error ? '监控连接异常' : stale ? '数据已过期' : status?.collectionError ? '采集异常' : snapshot ? '正在监控' : '首次采集中'}
        </Label>
        {snapshot && <span className={styles.sampled}>采样 {new Date(snapshot.at).toLocaleTimeString('zh-CN')}</span>}
        <IconButton icon={SyncIcon} label="立即采集" disabled={refreshing} className={`${styles.refresh} ${refreshing ? styles.spin : ''}`} onClick={() => void refresh()} />
      </header>
      <div className={styles.layout}>
        <nav className={styles.sections} aria-label="系统分区">
          <ul className={`${list.list} ${styles.sectionList}`}>
            {[
              { id: 'host', name: '宿主 Mac', hint: '硬件与 macOS', icon: DeviceDesktopIcon, route: '/' },
              { id: 'agent', name: 'Agent', hint: '账号与额度', icon: CopilotIcon, route: '/agent' },
              { id: 'binos', name: 'binOS', hint: '运行与维护', icon: PulseIcon, route: '/binos' },
            ].map((item) => (
              <li key={item.id}>
                <button type="button" className={`${list.item} ${styles.section}`} aria-current={section === item.id ? 'page' : undefined} onClick={() => ctx.navigate(item.route)}>
                  <span className={list.visual}>
                    <item.icon size={16} />
                  </span>
                  <span className={list.content}>
                    <span className={list.label}>{item.name}</span>
                    <span className={`${list.description} ${styles.hint}`}>{item.hint}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.body}>
          {(error || stale || actionError || status?.collectionError) && (
            <div className={styles.warnings}>
              {(error || stale || actionError) && (
                <Alert>
                  {actionError || error || '监控采样超过 30 秒未更新'}。
                  {error || stale ? `最后成功连接 ${moment(lastSuccess)}；保留的数据可能已过期，无法确认宿主当前正常。` : ''}
                </Alert>
              )}
              {status?.collectionError && <Alert>{status.collectionError}</Alert>}
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
            <Blankslate
              visual={error ? undefined : <Spinner size="medium" />}
              icon={error ? DeviceDesktopIcon : undefined}
              heading={error ? '暂时无法读取宿主状态' : '正在连接宿主监控…'}
              description={error ? '页面会自动重试。' : undefined}
            />
          )}
        </div>
      </div>
    </div>
  )
}

import { ArrowClockwiseRegular } from '@fluentui/react-icons/headless/svg/arrow-clockwise'
import { BotFilled, BotRegular } from '@fluentui/react-icons/headless/svg/bot'
import { DesktopFilled, DesktopRegular } from '@fluentui/react-icons/headless/svg/desktop'
import { PulseFilled, PulseRegular } from '@fluentui/react-icons/headless/svg/pulse'
import { useEffect, useState } from 'react'
import { Alert } from '../../ui/Alert.tsx'
import { IconButton } from '../../ui/IconButton.tsx'
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
  return (
    <div className={styles.app}>
      <header className={styles.top}>
        <div>
          <strong className={styles.appTitle}>系统</strong>
          <span className={styles.freshness} data-stale={!!error || stale || !!status?.collectionError}>
            {error ? '监控连接异常' : stale ? '数据已过期' : status?.collectionError ? '采集异常' : snapshot ? '正在监控' : '首次采集中'}
            <small>{snapshot ? `采样 ${new Date(snapshot.at).toLocaleTimeString('zh-CN')}` : ''}</small>
          </span>
        </div>
        <div className={styles.actions}>
          <IconButton label="立即采集" icon={<ArrowClockwiseRegular />} disabled={refreshing} className={refreshing ? styles.spin : undefined} onClick={() => void refresh()} />
        </div>
      </header>
      <div className={styles.main}>
      <nav className={styles.sections} aria-label="系统分区">
        {[
          { id: 'host', name: '宿主 Mac', hint: '硬件与 macOS', icon: DesktopRegular, selectedIcon: DesktopFilled, route: '/' },
          { id: 'agent', name: 'Agent', hint: '账号与额度', icon: BotRegular, selectedIcon: BotFilled, route: '/agent' },
          { id: 'binos', name: 'binOS', hint: '运行与维护', icon: PulseRegular, selectedIcon: PulseFilled, route: '/binos' },
        ].map((item) => {
          const Icon = section === item.id ? item.selectedIcon : item.icon
          return (
            <button key={item.id} className={styles.sectionItem} aria-current={section === item.id ? 'page' : undefined} onClick={() => ctx.navigate(item.route)}>
              <Icon className={styles.sectionIcon} />
              <span>
                {item.name}
                <small>{item.hint}</small>
              </span>
            </button>
          )
        })}
      </nav>
      <div className={styles.body}>
      {(error || stale || actionError) && (
        <Alert intent="warning" className={styles.warning}>
          {actionError || error || '监控采样超过 30 秒未更新'}。
          {error || stale ? `最后成功连接 ${moment(lastSuccess)}；保留的数据可能已过期，无法确认宿主当前正常。` : ''}
        </Alert>
      )}
      {status?.collectionError && (
        <Alert intent="warning" className={styles.warning}>
          {status.collectionError}
        </Alert>
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
          <p className={styles.empty}>{error ? '暂时无法读取宿主状态。页面会自动重试。' : '正在连接宿主监控…'}</p>
        )}
      </div>
      </div>
    </div>
  )
}

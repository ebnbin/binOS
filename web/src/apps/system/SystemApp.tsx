import { Button, MessageBar, MessageBarBody, Tab, TabList, Title3 } from '@fluentui/react-components'
import {
  ArrowClockwiseRegular as RefreshCw,
  BotRegular as Bot,
  DesktopRegular as Monitor,
  PulseRegular as Activity,
} from '@fluentui/react-icons'
import { useEffect, useState } from 'react'
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
          <Title3>系统</Title3>
          <span className={styles.freshness} data-stale={!!error || stale || !!status?.collectionError}>
            {error ? '监控连接异常' : stale ? '数据已过期' : status?.collectionError ? '采集异常' : snapshot ? '正在监控' : '首次采集中'}
            <small>{snapshot ? `采样 ${new Date(snapshot.at).toLocaleTimeString('zh-CN')}` : ''}</small>
          </span>
        </div>
        <div className={styles.actions}>
          <Button
            type="submit"
            size="small"
            icon={<RefreshCw fontSize={16} className={refreshing ? styles.spin : ''} />}
            appearance="subtle"
            title="立即采集"
            aria-label="立即采集"
            disabled={refreshing}
            onClick={() => void refresh()}
          />
        </div>
      </header>
      <TabList
        className={styles.sections}
        aria-label="系统分区"
        selectedValue={section}
        vertical
        onTabSelect={(_, data) => ctx.navigate(data.value === 'host' ? '/' : `/${data.value}`)}
      >
        {[
          { id: 'host', name: '宿主 Mac', hint: '硬件与 macOS', icon: Monitor, route: '/' },
          { id: 'agent', name: 'Agent', hint: '账号与额度', icon: Bot, route: '/agent' },
          { id: 'binos', name: 'binOS', hint: '运行与维护', icon: Activity, route: '/binos' },
        ].map((item) => (
          <Tab key={item.id} value={item.id} icon={<item.icon />} aria-label={item.name} title={item.hint}>
            <span>
              {item.name}
              <small>{item.hint}</small>
            </span>
          </Tab>
        ))}
      </TabList>
      {(error || stale || actionError) && (
        <MessageBar intent="warning" className={styles.warning}>
          <MessageBarBody>
            {actionError || error || '监控采样超过 30 秒未更新'}。
            {error || stale ? `最后成功连接 ${moment(lastSuccess)}；保留的数据可能已过期，无法确认宿主当前正常。` : ''}
          </MessageBarBody>
        </MessageBar>
      )}
      {status?.collectionError && (
        <MessageBar intent="warning" className={styles.warning}>
          <MessageBarBody>{status.collectionError}</MessageBarBody>
        </MessageBar>
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
          <p className={styles.empty}>{error ? '暂时无法读取宿主状态。页面会自动重试。' : '正在连接宿主监控…'}</p>
        )}
      </div>
    </div>
  )
}

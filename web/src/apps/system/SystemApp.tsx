import { SegmentedControl } from '../../ui/SegmentedControl.tsx'
import { Button } from '../../ui/Controls.tsx'
import { Activity, Bot, Monitor, RefreshCw } from 'lucide-react'
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
          <strong>系统</strong>
          <span className={styles.freshness} data-stale={!!error || stale || !!status?.collectionError}>
            {error ? '监控连接异常' : stale ? '数据已过期' : status?.collectionError ? '采集异常' : snapshot ? '正在监控' : '首次采集中'}
            <small>{snapshot ? `采样 ${new Date(snapshot.at).toLocaleTimeString('zh-CN')}` : ''}</small>
          </span>
        </div>
        <div className={styles.actions}>
          <Button title="立即采集" aria-label="立即采集" disabled={refreshing} onClick={() => void refresh()}>
            <RefreshCw size={16} className={refreshing ? styles.spin : ''} />
          </Button>
        </div>
      </header>
      <SegmentedControl
        label="系统分区"
        className={styles.sections}
        value={section}
        onValueChange={(next) => ctx.navigate(next === 'host' ? '/' : next === 'agent' ? '/agent' : '/binos')}
        options={[
          {
            value: 'host',
            label: (
              <>
                <Monitor size={18} />
                宿主 Mac
              </>
            ),
          },
          {
            value: 'agent',
            label: (
              <>
                <Bot size={18} />
                Agent
              </>
            ),
          },
          {
            value: 'binos',
            label: (
              <>
                <Activity size={18} />
                binOS
              </>
            ),
          },
        ]}
      />

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
          <p className={styles.empty}>{error ? '暂时无法读取宿主状态。页面会自动重试。' : '正在连接宿主监控…'}</p>
        )}
      </div>
    </div>
  )
}

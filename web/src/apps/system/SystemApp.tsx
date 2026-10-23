import { Badge, Callout, Flex, Heading, TabNav, Text } from '@radix-ui/themes'
import { useEffect, useState } from 'react'
import { IconButton } from '../../ui/IconButton.tsx'
import { ActivityLogIcon, BotIcon, DesktopIcon, ExclamationTriangleIcon, ReloadIcon } from '../../ui/icons.ts'
import { useApplications } from '../index.ts'
import type { WindowContext } from '../types.ts'
import { AgentAccounts } from './AgentAccounts.tsx'
import { BinosMonitor } from './BinosMonitor.tsx'
import { HostMonitor } from './HostMonitor.tsx'
import { moment } from './format.ts'
import { refreshMonitor, systemRequest, useMonitor } from './monitor.ts'
import styles from './Monitor.module.css'

const sections = [
  { id: 'host', name: '宿主 Mac', hint: '硬件与 macOS', icon: DesktopIcon, route: '/' },
  { id: 'agent', name: 'Agent', hint: '账号与额度', icon: BotIcon, route: '/agent' },
  { id: 'binos', name: 'binOS', hint: '运行与维护', icon: ActivityLogIcon, route: '/binos' },
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
  const bad = !!error || stale || !!status?.collectionError
  const Settings = app?.settings?.component
  return (
    <div className={styles.app}>
      <header className={styles.top}>
        <Flex align="center" gap="3" minWidth="0">
          <Heading as="h1" size="4">
            系统
          </Heading>
          <Badge size="1" variant="soft" color={bad ? 'red' : snapshot ? 'green' : 'gray'}>
            {error ? '监控连接异常' : stale ? '数据已过期' : status?.collectionError ? '采集异常' : snapshot ? '正在监控' : '首次采集中'}
          </Badge>
          {snapshot && (
            <Text size="1" color="gray" className={styles.sampled}>
              采样 {new Date(snapshot.at).toLocaleTimeString('zh-CN')}
            </Text>
          )}
        </Flex>
        <IconButton icon={ReloadIcon} label="立即采集" loading={refreshing} onClick={() => void refresh()} />
      </header>
      <TabNav.Root aria-label="系统分区" className={styles.sections}>
        {sections.map((item) => (
          <TabNav.Link key={item.id} asChild active={section === item.id}>
            <button type="button" title={item.hint} onClick={() => ctx.navigate(item.route)}>
              <Flex as="span" align="center" gap="2">
                <item.icon />
                {item.name}
              </Flex>
            </button>
          </TabNav.Link>
        ))}
      </TabNav.Root>
      <div className={styles.body}>
        {(error || stale || actionError || status?.collectionError) && (
          <Flex direction="column" gap="2" className={styles.alerts}>
            {(error || stale || actionError) && (
              <Callout.Root color="red" size="1" role="alert">
                <Callout.Icon>
                  <ExclamationTriangleIcon />
                </Callout.Icon>
                <Callout.Text className={styles.wrap}>
                  {actionError || error || '监控采样超过 30 秒未更新'}。
                  {error || stale ? `最后成功连接 ${moment(lastSuccess)}；保留的数据可能已过期，无法确认宿主当前正常。` : ''}
                </Callout.Text>
              </Callout.Root>
            )}
            {status?.collectionError && (
              <Callout.Root color="red" size="1" role="alert">
                <Callout.Icon>
                  <ExclamationTriangleIcon />
                </Callout.Icon>
                <Callout.Text className={styles.wrap}>{status.collectionError}</Callout.Text>
              </Callout.Root>
            )}
          </Flex>
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
          <Text as="p" size="2" color="gray" className={styles.empty}>
            {error ? '暂时无法读取宿主状态。页面会自动重试。' : '正在连接宿主监控…'}
          </Text>
        )}
      </div>
    </div>
  )
}

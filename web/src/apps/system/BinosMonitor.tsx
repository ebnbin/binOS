import type { MonitorStatus } from '@binos/server/apps/system/types'
import { Badge, Card, Code, DataList, Heading, Text } from '@radix-ui/themes'
import { useConnected } from '../../events.ts'
import { ChevronRightIcon } from '../../ui/icons.ts'
import { useApplications } from '../index.ts'
import { ExternalApps } from './ExternalApps.tsx'
import { bytes } from './format.ts'
import styles from './Monitor.module.css'

export function BinosMonitor({ status, navigate }: { status?: MonitorStatus; navigate(route: string): void }) {
  const connected = useConnected()
  const apps = useApplications().filter((app) => app.settings)
  const runtime = status?.snapshot?.runtime
  return (
    <div className={styles.content}>
      <header className={styles.hero}>
        <Heading as="h2" size="6">
          binOS
        </Heading>
        <Text as="p" size="2" color="gray">
          系统状态与应用设置
        </Text>
      </header>
      <Card size="2">
        <DataList.Root size="2">
          <DataList.Item align="center">
            <DataList.Label minWidth="120px">连接状态</DataList.Label>
            <DataList.Value>
              <Badge size="1" variant="soft" color={connected ? 'green' : 'red'}>
                {connected ? '已连接' : '连接已断开'}
              </Badge>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label minWidth="120px">版本</DataList.Label>
            <DataList.Value>
              {runtime?.version ? (
                <Code variant="ghost" title={runtime.version}>
                  {runtime.version.slice(0, 7)}
                </Code>
              ) : (
                '读取中'
              )}
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label minWidth="120px">运行环境</DataList.Label>
            <DataList.Value>{runtime ? (runtime.test ? '测试 / 预览' : '正式版') : '读取中'}</DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label minWidth="120px">已运行</DataList.Label>
            <DataList.Value className={styles.numeric}>
              {runtime ? `${Math.floor(runtime.uptime / 3600)} 小时 ${Math.floor((runtime.uptime % 3600) / 60)} 分钟` : '读取中'}
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label minWidth="120px">binOS 内存占用</DataList.Label>
            <DataList.Value className={styles.numeric}>{bytes(runtime?.memory)}</DataList.Value>
          </DataList.Item>
        </DataList.Root>
      </Card>
      {apps.length > 0 && (
        <Card size="2" asChild>
          <section>
            <Heading as="h3" size="3" mb="2">
              应用设置
            </Heading>
            {apps.map((app) => (
              <button type="button" className={styles.link} key={app.id} onClick={() => navigate(`/apps/${app.id}`)}>
                <Text size="2">{app.name}</Text>
                <Text size="1" color="gray" className={styles.linkHint}>
                  {app.settings!.hint}
                </Text>
                <ChevronRightIcon />
              </button>
            ))}
          </section>
        </Card>
      )}
      <ExternalApps />
    </div>
  )
}

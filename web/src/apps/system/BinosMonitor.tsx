import { ButtonBase, Card } from '@mui/material'

import type { MonitorStatus } from '@binos/server/apps/system/types'
import { useConnected } from '../../events.ts'
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
        <h1>binOS</h1>
        <p>系统状态与应用设置</p>
      </header>
      <Card component="section" className={styles.section}>
        <dl className={styles.rows}>
          <div>
            <dt>连接状态</dt>
            <dd>{connected ? '已连接' : '连接已断开'}</dd>
          </div>
          <div>
            <dt>版本</dt>
            <dd title={runtime?.version}>{runtime?.version.slice(0, 7) || '读取中'}</dd>
          </div>
          <div>
            <dt>运行环境</dt>
            <dd>{runtime ? (runtime.test ? '测试 / 预览' : '正式版') : '读取中'}</dd>
          </div>
          <div>
            <dt>已运行</dt>
            <dd>{runtime ? `${Math.floor(runtime.uptime / 3600)} 小时 ${Math.floor((runtime.uptime % 3600) / 60)} 分钟` : '读取中'}</dd>
          </div>
          <div>
            <dt>binOS 内存占用</dt>
            <dd>{bytes(runtime?.memory)}</dd>
          </div>
        </dl>
      </Card>
      {apps.length > 0 && (
        <Card component="section" className={styles.section}>
          <h2>应用设置</h2>
          {apps.map((app) => (
            <ButtonBase type="submit" className={styles.settingLink} key={app.id} onClick={() => navigate(`/apps/${app.id}`)}>
              {app.name}
              <span>{app.settings!.hint}</span>
            </ButtonBase>
          ))}
        </Card>
      )}
      <ExternalApps />
    </div>
  )
}

import type { MonitorStatus } from '@binos/server/apps/system/types'
import { ChevronRightIcon } from '@primer/octicons-react'
import { useConnected } from '../../events.ts'
import { Label } from '../../ui/Label.tsx'
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
      <header className={styles.subhead}>
        <h2>binOS</h2>
        <p>系统状态与应用设置</p>
      </header>
      <section className={styles.box}>
        <dl className={styles.rows}>
          <div>
            <dt>连接状态</dt>
            <dd>
              <Label variant={connected ? 'success' : 'danger'}>{connected ? '已连接' : '连接已断开'}</Label>
            </dd>
          </div>
          <div>
            <dt>版本</dt>
            <dd className={styles.mono} title={runtime?.version}>
              {runtime?.version.slice(0, 7) || '读取中'}
            </dd>
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
      </section>
      {apps.length > 0 && (
        <section className={styles.group}>
          <h3 className={styles.sectionTitle}>应用设置</h3>
          <div className={styles.box}>
            {apps.map((app) => (
              <button type="button" className={`${styles.boxRow} ${styles.settingLink}`} key={app.id} onClick={() => navigate(`/apps/${app.id}`)}>
                <span>
                  <strong>{app.name}</strong>
                  <small>{app.settings!.hint}</small>
                </span>
                <ChevronRightIcon size={16} />
              </button>
            ))}
          </div>
        </section>
      )}
      <ExternalApps />
    </div>
  )
}

import type { MonitorStatus } from '@binos/server/apps/system/types'
import { useConnected } from '../../events.ts'
import { StatusLight } from '../../ui/StatusLight.tsx'
import { UiIcon } from '../../ui/UiIcon.tsx'
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
        <h2 className={styles.heroTitle}>binOS</h2>
        <p>系统状态与应用设置</p>
      </header>
      <dl className={styles.rows}>
        <div>
          <dt>连接状态</dt>
          <dd>
            <StatusLight variant={connected ? 'positive' : 'negative'}>{connected ? '已连接' : '连接已断开'}</StatusLight>
          </dd>
        </div>
        <div>
          <dt>版本</dt>
          <dd className={styles.code} title={runtime?.version}>
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
      {apps.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>应用设置</h3>
          <div className={styles.links}>
            {apps.map((app) => (
              <button type="button" className={styles.settingLink} key={app.id} onClick={() => navigate(`/apps/${app.id}`)}>
                <span className={styles.linkText}>
                  {app.name}
                  <span className={styles.linkHint}>{app.settings!.hint}</span>
                </span>
                <UiIcon glyph="chevron" />
              </button>
            ))}
          </div>
        </section>
      )}
      <ExternalApps />
    </div>
  )
}

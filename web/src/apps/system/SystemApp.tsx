import { ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getVersion } from '../../api.ts'
import { useConnected } from '../../events.ts'
import { useApps } from '../index.ts'
import type { AppContext, AppManifest } from '../types.ts'
import { ExternalApps } from './ExternalApps.tsx'
import styles from './SystemApp.module.css'

// /：系统概况和各个 app 的设置入口；/<app 的 id>：这个 app 的设置页
export function SystemApp({ ctx }: { ctx: AppContext }) {
  const apps = useApps().filter((app) => app.settings)
  const app = apps.find((item) => ctx.route === `/${item.id}`)
  const { setTitle } = ctx
  const title = app?.name ?? ''
  useEffect(() => setTitle(title), [setTitle, title])
  if (app) {
    const Settings = app.settings!.component
    return <Settings back={ctx.back} />
  }
  return <Home apps={apps} onOpen={ctx.navigate} />
}

function Home({ apps, onOpen }: { apps: AppManifest[]; onOpen: (route: string) => void }) {
  const [version, setVersion] = useState<string>()
  const connected = useConnected()

  useEffect(() => {
    void getVersion().then(setVersion)
  }, [connected])

  return (
    <div className={styles.app}>
      <dl className={styles.list}>
        <div className={styles.row}>
          <dt>版本</dt>
          <dd className={styles.mono}>{version ? version.slice(0, 7) : '…'}</dd>
        </div>
        <div className={styles.row}>
          <dt>连接</dt>
          <dd>
            <span className={styles.dot} data-connected={connected} />
            {connected ? '已连接' : '已断开，正在重连'}
          </dd>
        </div>
      </dl>
      <div className={styles.links}>
        {apps.map((app) => (
          <button key={app.id} type="button" className={styles.link} onClick={() => onOpen(`/${app.id}`)}>
            <span>{app.name}</span>
            <span className={styles.linkHint}>{app.settings!.hint}</span>
            <ChevronRight size={16} strokeWidth={1.75} />
          </button>
        ))}
      </div>
      <ExternalApps />
    </div>
  )
}

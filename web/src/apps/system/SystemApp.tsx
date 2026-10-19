import { ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { getVersion } from '../../api.ts'
import { useConnected } from '../../events.ts'
import { useApps } from '../index.ts'
import type { AppContext, AppManifest } from '../types.ts'
import { AgentAccounts } from './AgentAccounts.tsx'
import { ExternalApps } from './ExternalApps.tsx'
import styles from './SystemApp.module.css'

// 系统自己的页面：路由 → 标题、说明和内容
const pages: Record<string, { title: string; hint: string; component: (props: { back(): void }) => ReactNode }> = {
  '/agent': { title: 'Agent', hint: '账号、额度和登录凭证', component: AgentAccounts },
}

// /：系统概况和各页入口；/agent 这类：系统自己的页面；/apps/<app 的 id>：这个 app 的设置页
export function SystemApp({ ctx }: { ctx: AppContext }) {
  const apps = useApps().filter((app) => app.settings)
  const page = pages[ctx.route]
  const app = apps.find((item) => ctx.route === `/apps/${item.id}`)
  const { setTitle } = ctx
  const title = page?.title ?? app?.name ?? ''
  useEffect(() => setTitle(title), [setTitle, title])
  const Page = page?.component ?? app?.settings?.component
  return Page ? <Page back={ctx.back} /> : <Home apps={apps} onOpen={ctx.navigate} />
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
        {[
          ...Object.entries(pages).map(([route, { title, hint }]) => ({ route, title, hint })),
          ...apps.map((app) => ({ route: `/apps/${app.id}`, title: app.name, hint: app.settings!.hint })),
        ].map(({ route, title, hint }) => (
          <button key={route} type="button" className={styles.link} onClick={() => onOpen(route)}>
            <span>{title}</span>
            <span className={styles.linkHint}>{hint}</span>
            <ChevronRight size={16} strokeWidth={1.75} />
          </button>
        ))}
      </div>
      <ExternalApps />
    </div>
  )
}

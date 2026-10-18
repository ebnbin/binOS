import { ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getVersion } from '../../api.ts'
import { useConnected } from '../../events.ts'
import type { AppContext } from '../types.ts'
import { AgentAccounts } from './AgentAccounts.tsx'
import { ExternalApps } from './ExternalApps.tsx'
import styles from './SystemApp.module.css'

// /：系统概况；/agent：agent 的账号、登录凭证和用量
export function SystemApp({ ctx }: { ctx: AppContext }) {
  const page = ctx.route === '/agent' ? 'agent' : 'home'
  const { setTitle } = ctx
  useEffect(() => setTitle(page === 'agent' ? 'Agent' : ''), [setTitle, page])
  return page === 'agent' ? <AgentAccounts onBack={ctx.back} /> : <Home onOpen={ctx.navigate} />
}

function Home({ onOpen }: { onOpen: (route: string) => void }) {
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
        <button type="button" className={styles.link} onClick={() => onOpen('/agent')}>
          <span>Agent</span>
          <span className={styles.linkHint}>账号、额度和登录凭证</span>
          <ChevronRight size={16} strokeWidth={1.75} />
        </button>
      </div>
      <ExternalApps />
    </div>
  )
}

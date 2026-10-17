import { useEffect, useState } from 'react'
import { getVersion } from '../../api.ts'
import { useConnected } from '../../events.ts'
import type { AppContext } from '../types.ts'
import styles from './SystemApp.module.css'

export function SystemApp({ ctx }: { ctx: AppContext }) {
  const [version, setVersion] = useState<string>()
  const connected = useConnected()

  useEffect(() => {
    void getVersion().then(setVersion)
  }, [connected])

  const { setTitle } = ctx
  useEffect(() => setTitle(''), [setTitle])

  return (
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
  )
}

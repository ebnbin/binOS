import { useConnected } from '../events.ts'
import styles from './ConnectionStatus.module.css'
import { Spinner } from './ui/Spinner.tsx'

export function ConnectionStatus() {
  const connected = useConnected()
  return (
    <div className={styles.status} data-visible={!connected} role="status" aria-hidden={connected}>
      <Spinner />
      连接已断开，正在重连…
    </div>
  )
}

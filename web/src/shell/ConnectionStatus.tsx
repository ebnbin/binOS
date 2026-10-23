import { useConnected, useUpdated } from '../events.ts'
import styles from './ConnectionStatus.module.css'
import { CircularProgress } from '../ui/Progress.tsx'

// 装到桌面或主屏幕后没有浏览器的刷新按钮，登录过期或上线了新版本时，从这里刷新。样式是 M3 的 snackbar
export function ConnectionStatus() {
  const connected = useConnected()
  const updated = useUpdated()
  const visible = updated || !connected
  return (
    <div className={styles.status} data-visible={visible} data-urgent={updated} role="status" aria-hidden={!visible}>
      {!updated && <CircularProgress size={20} />}
      <span className={styles.text}>{updated ? 'binOS 已更新' : '连接已断开，正在重连…'}</span>
      <button type="button" className={styles.reload} onClick={() => window.location.reload()}>
        刷新
      </button>
    </div>
  )
}

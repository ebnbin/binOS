import { Button, MessageBar, MessageBarActions, MessageBarBody } from '@fluentui/react-components'
import { useConnected, useUpdated } from '../events.ts'
import styles from './ConnectionStatus.module.css'
import { Spinner } from '../ui/Spinner.tsx'

// 装到桌面或主屏幕后没有浏览器的刷新按钮，登录过期或上线了新版本时，从这里刷新
export function ConnectionStatus() {
  const connected = useConnected()
  const updated = useUpdated()
  const visible = updated || !connected
  return (
    <MessageBar
      className={styles.status}
      data-visible={visible}
      data-urgent={updated}
      role="status"
      aria-hidden={!visible}
      intent={updated ? 'info' : 'warning'}
      icon={updated ? undefined : <Spinner />}
    >
      <MessageBarBody>{updated ? 'binOS 已更新' : '连接已断开，正在重连…'}</MessageBarBody>
      <MessageBarActions>
        <Button size="small" appearance="subtle" type="button" onClick={() => window.location.reload()}>
          刷新
        </Button>
      </MessageBarActions>
    </MessageBar>
  )
}

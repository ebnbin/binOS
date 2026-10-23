import type { ReactNode } from 'react'
import { ErrorIcon } from './icons.tsx'
import styles from './Alert.module.css'

// 错误提示：error-container 的填充卡片
export function Alert({ children }: { children: ReactNode }) {
  return (
    <div className={styles.alert} role="alert">
      <ErrorIcon size={20} className={styles.icon} />
      <span>{children}</span>
    </div>
  )
}

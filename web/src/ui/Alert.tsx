import { CircleAlert } from './icons'
import type { ReactNode } from 'react'
import styles from './Alert.module.css'

export function Alert({ children }: { children: ReactNode }) {
  return (
    <div className={styles.alert} role="alert">
      <CircleAlert className={styles.icon} />
      <span>{children}</span>
    </div>
  )
}

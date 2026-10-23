import { CheckmarkCircleFilled } from '@fluentui/react-icons/headless/svg/checkmark-circle'
import { DismissCircleFilled } from '@fluentui/react-icons/headless/svg/dismiss-circle'
import { InfoFilled } from '@fluentui/react-icons/headless/svg/info'
import { WarningFilled } from '@fluentui/react-icons/headless/svg/warning'
import type { ReactNode } from 'react'
import styles from './Alert.module.css'

const icons = { error: DismissCircleFilled, warning: WarningFilled, success: CheckmarkCircleFilled, info: InfoFilled }

// Fluent 2 的 MessageBar
export function Alert({ children, intent = 'error', title, actions, className }: {
  children: ReactNode
  intent?: 'error' | 'warning' | 'success' | 'info'
  title?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  const Icon = icons[intent]
  return (
    <div className={`${styles.alert} ${className ?? ''}`} data-intent={intent} role={intent === 'error' || intent === 'warning' ? 'alert' : 'status'}>
      <Icon className={styles.icon} />
      <div className={styles.body}>
        {title && <strong className={styles.title}>{title} </strong>}
        {children}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  )
}

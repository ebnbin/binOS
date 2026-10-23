import { AlertIcon, InfoIcon, StopIcon } from '@primer/octicons-react'
import type { ReactNode } from 'react'
import styles from './Alert.module.css'

const icons = { critical: StopIcon, warning: AlertIcon, info: InfoIcon }

// Primer Banner
export function Alert({ variant = 'critical', actions, className, children }: { variant?: keyof typeof icons; actions?: ReactNode; className?: string; children: ReactNode }) {
  const Icon = icons[variant]
  return (
    <div className={`${styles.banner} ${className ?? ''}`} data-variant={variant} role={variant === 'critical' ? 'alert' : 'status'}>
      <span className={styles.icon}><Icon size={16} /></span>
      <div className={styles.content}>{children}</div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  )
}

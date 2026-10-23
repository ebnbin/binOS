import type { HTMLAttributes, ReactNode } from 'react'
import styles from './Label.module.css'

export type LabelVariant = 'default' | 'accent' | 'success' | 'attention' | 'severe' | 'danger' | 'done'

export function Label({ variant = 'default', size = 'small', className, ...props }: { variant?: LabelVariant; size?: 'small' | 'large' } & HTMLAttributes<HTMLSpanElement>) {
  return <span className={`${styles.label} ${className ?? ''}`} data-variant={variant} data-size={size} {...props} />
}

export function CounterLabel({ variant = 'secondary', className, children }: { variant?: 'primary' | 'secondary'; className?: string; children: ReactNode }) {
  return <span className={`${styles.counter} ${className ?? ''}`} data-variant={variant === 'primary' ? 'emphasis' : undefined}>{children}</span>
}

export function StateLabel({ status, className, children }: { status: 'open' | 'merged' | 'closed' | 'draft'; className?: string; children: ReactNode }) {
  return <span className={`${styles.state} ${className ?? ''}`} data-status={status}>{children}</span>
}

import type { ReactNode } from 'react'
import { AlertTriangle, CheckmarkCircle, InfoCircle } from './icons.tsx'
import styles from './InlineAlert.module.css'

const icons = { negative: AlertTriangle, informative: InfoCircle, positive: CheckmarkCircle, neutral: undefined }

// Spectrum 2 的 in-line alert，默认是带描边的样式，subtle 是浅色填充
export function InlineAlert({
  children,
  heading,
  variant = 'negative',
  fillStyle = 'border',
  className,
}: {
  children: ReactNode
  heading?: string
  variant?: keyof typeof icons
  fillStyle?: 'border' | 'subtleFill'
  className?: string
}) {
  const Icon = icons[variant]
  return (
    <div className={`${styles.alert} ${className ?? ''}`} data-variant={variant} data-fill={fillStyle} role="alert">
      {Icon && <Icon className={styles.icon} />}
      {heading && <h4 className={styles.heading}>{heading}</h4>}
      <div className={styles.content}>{children}</div>
    </div>
  )
}

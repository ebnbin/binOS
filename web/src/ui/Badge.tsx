import type { ReactNode } from 'react'
import type { Icon } from './icons.tsx'
import styles from './Badge.module.css'

export type BadgeVariant = 'neutral' | 'accent' | 'informative' | 'positive' | 'notice' | 'negative' | 'purple'

// Spectrum 2 的 badge：不能交互的标签，S 24、M 32，圆角 7/8；bold 是实色底，subtle 是浅色底
export function Badge({ variant = 'neutral', fillStyle = 'subtle', size = 'S', icon: Icon, title, className, children }: {
  variant?: BadgeVariant
  fillStyle?: 'bold' | 'subtle' | 'outline'
  size?: 'S' | 'M'
  icon?: Icon
  title?: string
  className?: string
  children?: ReactNode
}) {
  return (
    <span className={`${styles.badge} ${className ?? ''}`} data-variant={variant} data-fill={fillStyle} data-size={size} title={title}>
      {Icon && <Icon size={size === 'S' ? 'S' : 'M'} />}
      {children !== undefined && <span className={styles.label}>{children}</span>}
    </span>
  )
}

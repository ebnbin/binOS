import type { ReactNode } from 'react'
import styles from './Badge.module.css'

export type BadgeColor = 'brand' | 'danger' | 'success' | 'warning' | 'severe' | 'informative' | 'important'

// Fluent 2 的 Badge：filled 实心、tint 浅底、outline 描边、ghost 只有文字
export function Badge({ children, color = 'brand', appearance = 'filled', size = 'medium', shape = 'rounded', icon, className, title }: {
  children?: ReactNode
  color?: BadgeColor
  appearance?: 'filled' | 'tint' | 'outline' | 'ghost'
  size?: 'tiny' | 'extra-small' | 'small' | 'medium' | 'large'
  shape?: 'rounded' | 'circular'
  icon?: ReactNode
  className?: string
  title?: string
}) {
  return (
    <span className={`${styles.badge} ${className ?? ''}`} data-color={color} data-appearance={appearance} data-size={size} data-shape={shape} title={title}>
      {icon && <span className={styles.icon}>{icon}</span>}
      {children}
    </span>
  )
}

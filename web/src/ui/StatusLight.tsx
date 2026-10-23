import type { ReactNode } from 'react'
import styles from './StatusLight.module.css'

// Spectrum 2 的 status light：彩色圆点加文字，neutral 的文字是 gray-600
export function StatusLight({ variant = 'neutral', size = 'M', className, children }: {
  variant?: 'neutral' | 'informative' | 'positive' | 'notice' | 'negative' | 'purple'
  size?: 'S' | 'M'
  className?: string
  children?: ReactNode
}) {
  return (
    <span className={`${styles.light} ${className ?? ''}`} data-variant={variant} data-size={size}>
      {children}
    </span>
  )
}

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { Icon } from './icons.tsx'
import { ProgressCircle } from './ProgressCircle.tsx'
import styles from './Button.module.css'

export type ButtonVariant = 'accent' | 'primary' | 'secondary' | 'negative'

// Spectrum 2 的按钮：胶囊形，accent 是最主要的操作，primary 是深色，secondary 是浅灰；outline 只用于 primary 和 secondary
export function Button({
  variant = 'primary',
  fillStyle = 'fill',
  size = 'M',
  staticColor,
  icon: Icon,
  pending,
  className,
  children,
  ...props
}: {
  variant?: ButtonVariant
  fillStyle?: 'fill' | 'outline'
  size?: 'S' | 'M' | 'L'
  staticColor?: 'white'
  icon?: Icon
  pending?: boolean
  children?: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`${styles.button} ${className ?? ''}`}
      data-variant={variant}
      data-fill={fillStyle}
      data-size={size}
      data-static={staticColor}
      data-pending={pending || undefined}
      aria-busy={pending || undefined}
      {...props}
      disabled={props.disabled || pending}
    >
      {Icon && <Icon size={size} />}
      {children !== undefined && <span className={styles.label}>{children}</span>}
      {pending && (
        <span className={styles.pending}>
          <ProgressCircle staticColor={variant === 'accent' || variant === 'negative' ? 'white' : undefined} />
        </span>
      )}
    </button>
  )
}

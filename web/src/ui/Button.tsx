import type { ButtonHTMLAttributes } from 'react'
import type { Icon } from './icons.tsx'
import { Ripple } from './Ripple.tsx'
import styles from './Button.module.css'

export type ButtonVariant = 'filled' | 'tonal' | 'outlined' | 'text' | 'elevated'

// M3 Expressive 的按钮：xs 32、s 40、m 56 高，默认圆形，按下时圆角收紧
export function Button({
  variant = 'filled',
  size = 's',
  icon: Leading,
  trailingIcon: Trailing,
  className,
  children,
  ...props
}: {
  variant?: ButtonVariant
  size?: 'xs' | 's' | 'm'
  icon?: Icon
  trailingIcon?: Icon
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const iconSize = size === 'm' ? 24 : 20
  return (
    <button type="button" className={`${styles.button} ${className ?? ''}`} data-variant={variant} data-size={size} {...props}>
      <Ripple />
      {Leading && <Leading size={iconSize} />}
      {children}
      {Trailing && <Trailing size={iconSize} />}
    </button>
  )
}

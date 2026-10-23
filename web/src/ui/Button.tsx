import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import styles from './Button.module.css'

export type ButtonAppearance = 'secondary' | 'primary' | 'outline' | 'subtle' | 'transparent'
export type ButtonSize = 'small' | 'medium' | 'large'

// Fluent 2 的 Button。icon 放 Fluent System Icons 的可缩放图标（如 <AddRegular />），尺寸由按钮决定；没有文字时是方形的图标按钮，要给 aria-label
export function Button({
  appearance = 'secondary',
  size = 'medium',
  shape = 'rounded',
  icon,
  iconPosition = 'before',
  className,
  children,
  ref,
  type = 'button',
  ...props
}: {
  appearance?: ButtonAppearance
  size?: ButtonSize
  shape?: 'rounded' | 'circular'
  icon?: ReactNode
  iconPosition?: 'before' | 'after'
  ref?: Ref<HTMLButtonElement>
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const iconOnly = !!icon && (children === undefined || children === null || children === false)
  return (
    <button
      ref={ref}
      type={type}
      className={`${styles.button} ${className ?? ''}`}
      data-appearance={appearance}
      data-size={size}
      data-shape={shape}
      data-icon-only={iconOnly || undefined}
      data-icon-position={iconPosition}
      {...props}
    >
      {icon && <span className={styles.icon}>{icon}</span>}
      {children}
    </button>
  )
}

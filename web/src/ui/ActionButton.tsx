import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { Icon } from './icons.tsx'
import styles from './ActionButton.module.css'

export type ActionButtonProps = {
  icon?: Icon
  // 只有图标时作为无障碍名称和提示
  label?: string
  size?: 'XS' | 'S' | 'M' | 'L'
  quiet?: boolean
  // 切换按钮的选中态
  selected?: boolean
  staticColor?: 'white'
  children?: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>

// Spectrum 2 的 action button：圆角矩形，默认浅灰底，quiet 没有底色；selected 时是深色底（toggle button）
export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(function ActionButton(
  { icon: Icon, label, size = 'M', quiet, selected, staticColor, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={children === undefined ? label : undefined}
      title={label}
      aria-pressed={selected}
      className={`${styles.button} ${className ?? ''}`}
      data-size={size}
      data-quiet={quiet || undefined}
      data-static={staticColor}
      {...props}
    >
      {Icon && <Icon size={size === 'XS' ? 'XS' : size === 'S' ? 'S' : size === 'L' ? 'L' : 'M'} />}
      {children !== undefined && <span className={styles.label}>{children}</span>}
    </button>
  )
})

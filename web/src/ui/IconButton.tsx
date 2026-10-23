import type { ButtonHTMLAttributes } from 'react'
import type { Icon } from './icons.tsx'
import { Ripple } from './Ripple.tsx'
import styles from './IconButton.module.css'
import { Tooltip } from './Tooltip.tsx'

export type IconButtonVariant = 'standard' | 'filled' | 'tonal' | 'outlined'

// M3 Expressive 的图标按钮：xs 32、s 40、m 56，宽度分窄、默认、宽。传了 selected 就是开关按钮，选中时由圆变方、图标填充
export function IconButton({
  icon: Glyph,
  label,
  variant = 'standard',
  size = 's',
  width = 'default',
  selected,
  tooltip = true,
  className,
  ...props
}: {
  icon: Icon
  label: string
  variant?: IconButtonVariant
  size?: 'xs' | 's' | 'm'
  width?: 'narrow' | 'default' | 'wide'
  selected?: boolean
  tooltip?: boolean
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const button = (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      className={`${styles.button} ${className ?? ''}`}
      data-variant={variant}
      data-size={size}
      data-width={width}
      {...props}
    >
      <Ripple />
      <Glyph size={size === 'xs' ? 20 : 24} filled={selected} />
    </button>
  )
  return tooltip ? <Tooltip label={label}>{button}</Tooltip> : button
}

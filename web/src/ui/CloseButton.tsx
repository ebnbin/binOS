import type { ButtonHTMLAttributes } from 'react'
import { UiIcon } from './UiIcon.tsx'
import styles from './CloseButton.module.css'

// Spectrum 2 的 close button：圆形，悬停时出现浅灰底
export function CloseButton({ label = '关闭', size = 'M', staticColor, className, ...props }: { label?: string; size?: 'S' | 'M' | 'L'; staticColor?: 'white' } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" aria-label={label} title={label} className={`${styles.button} ${className ?? ''}`} data-size={size} data-static={staticColor} {...props}>
      <UiIcon glyph="cross" />
    </button>
  )
}

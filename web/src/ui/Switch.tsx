import type { InputHTMLAttributes } from 'react'
import styles from './Switch.module.css'

// Fluent 2 的 Switch：立即生效的开关。原生 checkbox 加 role="switch"
export function Switch({ label, className, ...props }: { label: string } & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return (
    <label className={`${styles.root} ${className ?? ''}`} data-disabled={props.disabled || undefined}>
      <input type="checkbox" role="switch" className={styles.input} {...props} />
      <span className={styles.track} aria-hidden><span className={styles.thumb} /></span>
      <span className={styles.label}>{label}</span>
    </label>
  )
}

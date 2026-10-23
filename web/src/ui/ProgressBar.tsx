import styles from './ProgressBar.module.css'

// Fluent 2 的 ProgressBar：value 是 0～1，不给时是不确定进度
export function ProgressBar({ value, thickness = 'medium', intent = 'brand', label, className }: {
  value?: number
  thickness?: 'medium' | 'large'
  intent?: 'brand' | 'error' | 'warning' | 'success'
  label?: string
  className?: string
}) {
  const determinate = value !== undefined
  return (
    <div
      className={`${styles.track} ${className ?? ''}`}
      data-thickness={thickness}
      data-intent={intent}
      role="progressbar"
      aria-label={label}
      aria-valuemin={determinate ? 0 : undefined}
      aria-valuemax={determinate ? 100 : undefined}
      aria-valuenow={determinate ? Math.round(value * 100) : undefined}
    >
      <div className={styles.bar} data-indeterminate={!determinate || undefined} style={determinate ? { width: `${Math.min(1, Math.max(0, value)) * 100}%` } : undefined} />
    </div>
  )
}

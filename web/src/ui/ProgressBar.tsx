import styles from './ProgressBar.module.css'

export type ProgressTone = 'accent' | 'success' | 'attention' | 'severe' | 'danger' | 'done' | 'neutral'

// progress 是 0 到 100
export function ProgressBar({ progress, tone = 'accent', size = 'default', label, className }: {
  progress: number
  tone?: ProgressTone
  size?: 'small' | 'default' | 'large'
  label?: string
  className?: string
}) {
  const value = Math.max(0, Math.min(100, progress))
  return (
    <span className={`${styles.track} ${className ?? ''}`} data-size={size} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)}>
      <span className={styles.bar} data-tone={tone} style={{ width: `${value}%` }} />
    </span>
  )
}

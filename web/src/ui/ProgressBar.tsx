import styles from './ProgressBar.module.css'

// Spectrum 2 的 progress bar 和 meter：胶囊形的轨道，M 6px 粗；meter 按语义着色
export function ProgressBar({ value, label, valueLabel, variant = 'accent', size = 'M', className }: {
  value?: number
  label?: string
  valueLabel?: string
  variant?: 'accent' | 'informative' | 'positive' | 'notice' | 'negative'
  size?: 'S' | 'M'
  className?: string
}) {
  const indeterminate = value === undefined
  return (
    <div
      className={`${styles.bar} ${className ?? ''}`}
      data-variant={variant}
      data-size={size}
      role={variant === 'accent' ? 'progressbar' : 'meter'}
      aria-label={label}
      aria-valuenow={indeterminate ? undefined : value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {(label || valueLabel) && (
        <div className={styles.labels}>
          <span>{label}</span>
          {!indeterminate && valueLabel && <span className={styles.value}>{valueLabel}</span>}
        </div>
      )}
      <div className={styles.track}>
        <div className={styles.fill} data-indeterminate={indeterminate || undefined} style={indeterminate ? undefined : { width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  )
}

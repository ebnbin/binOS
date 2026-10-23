import styles from './Progress.module.css'

// M3 的不定进度：转动的圆弧，标准尺寸 40、线宽 4，小尺寸按比例缩
export function CircularProgress({ size = 20, label = '进行中' }: { size?: number; label?: string }) {
  return (
    <svg className={styles.circular} width={size} height={size} viewBox="0 0 40 40" role="progressbar" aria-label={label}>
      <circle cx="20" cy="20" r="18" />
    </svg>
  )
}

// M3 的线性进度：有值时是进度和轨道两段，中间留 4 的缝，末端有停止点；没有值时是来回滑动的两段
export function LinearProgress({ value, label = '进行中', className }: { value?: number; label?: string; className?: string }) {
  const determinate = value !== undefined
  return (
    <div
      className={`${styles.linear} ${className ?? ''}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={determinate ? 0 : undefined}
      aria-valuemax={determinate ? 1 : undefined}
      aria-valuenow={value}
      data-indeterminate={!determinate}
      style={determinate ? { ['--value' as string]: Math.max(0, Math.min(1, value)) } : undefined}
    >
      <span className={styles.active} />
      <span className={styles.track} />
    </div>
  )
}

import styles from './ProgressCircle.module.css'

// Spectrum 2 的 progress circle：S 16、M 32、L 64；不给 value 时是不确定进度
export function ProgressCircle({ size = 'S', value, label = '进行中', staticColor }: { size?: 'S' | 'M' | 'L'; value?: number; label?: string; staticColor?: 'white' }) {
  const indeterminate = value === undefined
  return (
    <span
      className={styles.circle}
      data-size={size}
      data-static={staticColor}
      role="progressbar"
      aria-label={label}
      aria-valuenow={indeterminate ? undefined : value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg aria-hidden>
        <circle className={styles.track} cx="50%" cy="50%" />
        <circle
          className={styles.fill}
          cx="50%"
          cy="50%"
          pathLength={100}
          data-indeterminate={indeterminate || undefined}
          style={indeterminate ? undefined : { strokeDashoffset: 100 - Math.max(0, Math.min(100, value)) }}
        />
      </svg>
    </span>
  )
}

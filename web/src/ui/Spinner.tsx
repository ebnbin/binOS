import styles from './Spinner.module.css'

export type SpinnerSize = 'extra-tiny' | 'tiny' | 'extra-small' | 'small' | 'medium' | 'large'

// Fluent 2 的 Spinner：浅色轨道上转动的品牌色弧线，弧长随转动伸缩
export function Spinner({ size = 'extra-tiny', label = '进行中' }: { size?: SpinnerSize; label?: string }) {
  return (
    <span className={styles.spinner} data-size={size} role="progressbar" aria-label={label}>
      <svg viewBox="0 0 16 16" aria-hidden>
        <circle className={styles.track} cx="8" cy="8" r="7" />
        <circle className={styles.tail} cx="8" cy="8" r="7" pathLength="100" />
      </svg>
    </span>
  )
}

import styles from './Spinner.module.css'

// AdwSpinner：一圈淡淡的轨道上转着一段伸缩的弧，颜色跟随文字
export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg className={styles.spinner} width={size} height={size} viewBox="0 0 16 16" role="status" aria-label="进行中">
      <circle className={styles.track} cx="8" cy="8" r="7" />
      <circle className={styles.arc} cx="8" cy="8" r="7" pathLength="100" />
    </svg>
  )
}

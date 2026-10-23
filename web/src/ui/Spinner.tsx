import styles from './Spinner.module.css'

const sizes = { small: 16, medium: 32, large: 64 }

// Primer Spinner：淡色圆环上转动的一段弧，颜色跟随文字
export function Spinner({ size = 'small', className }: { size?: keyof typeof sizes; className?: string }) {
  const pixels = sizes[size]
  return (
    <svg className={`${styles.spinner} ${className ?? ''}`} width={pixels} height={pixels} viewBox="0 0 16 16" fill="none" role="status" aria-label="进行中">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <path d="M15 8a7.002 7.002 0 00-7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

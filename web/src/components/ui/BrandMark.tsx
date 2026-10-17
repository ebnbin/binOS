// 36 × 36 网格：竖线是 1，圆环是 0，两笔分开。0 只压住 1 四分之一线宽，1 停在 0 的圆心高度；左右边距 9 / 8 用来平衡偏左的重心
export function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" aria-hidden>
      <rect width="36" height="36" rx="8" fill="var(--ink)" />
      <path d="M11 8V21" stroke="var(--on-ink)" strokeWidth="4" strokeLinecap="round" />
      <circle cx="20" cy="21" r="6" stroke="var(--on-ink)" strokeWidth="4" />
    </svg>
  )
}

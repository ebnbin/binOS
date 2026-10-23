import { logo } from '../logo.ts'

// 墨色取所在主题的 gray-12，在深色的任务栏上自动反白
export function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox={`0 0 ${logo.size} ${logo.size}`} fill="none" aria-hidden>
      <rect width={logo.size} height={logo.size} rx={logo.radius} fill="var(--gray-12)" />
      <path d={logo.one} stroke="var(--gray-1)" strokeWidth={logo.stroke} strokeLinecap="round" />
      <circle {...logo.zero} stroke="var(--gray-1)" strokeWidth={logo.stroke} />
    </svg>
  )
}

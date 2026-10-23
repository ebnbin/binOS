import { logo } from '../logo.ts'

// inverted：放在外框的黑底上，和 Windows 11 任务栏的开始按钮一样用品牌色，不跟随深浅色
export function BrandMark({ size = 24, inverted = false }: { size?: number; inverted?: boolean }) {
  const ink = inverted ? 'var(--colorChromeBrand)' : 'var(--colorBrandBackground)'
  const onInk = inverted ? 'var(--colorChromeForeground1)' : 'var(--colorNeutralForegroundOnBrand)'
  return (
    <svg width={size} height={size} viewBox={`0 0 ${logo.size} ${logo.size}`} fill="none" aria-hidden>
      <rect width={logo.size} height={logo.size} rx={logo.radius} fill={ink} />
      <path d={logo.one} stroke={onInk} strokeWidth={logo.stroke} strokeLinecap="round" />
      <circle {...logo.zero} stroke={onInk} strokeWidth={logo.stroke} />
    </svg>
  )
}

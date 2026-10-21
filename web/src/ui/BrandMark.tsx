import { logo } from '../logo.ts'

// inverted：放在纯黑底上，不跟随深浅色
export function BrandMark({ size = 24, inverted = false }: { size?: number; inverted?: boolean }) {
  const ink = inverted ? '#fff' : 'var(--md-sys-color-primary)'
  const onInk = inverted ? '#000' : 'var(--md-sys-color-on-primary)'
  return (
    <svg width={size} height={size} viewBox={`0 0 ${logo.size} ${logo.size}`} fill="none" aria-hidden>
      <rect width={logo.size} height={logo.size} rx={logo.radius} fill={ink} />
      <path d={logo.one} stroke={onInk} strokeWidth={logo.stroke} strokeLinecap="round" />
      <circle {...logo.zero} stroke={onInk} strokeWidth={logo.stroke} />
    </svg>
  )
}

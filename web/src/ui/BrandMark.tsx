import { logo } from '../logo.ts'

export function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox={`0 0 ${logo.size} ${logo.size}`} fill="none" aria-hidden>
      <rect width={logo.size} height={logo.size} rx={logo.radius} fill="var(--ink)" />
      <path d={logo.one} stroke="var(--on-ink)" strokeWidth={logo.stroke} strokeLinecap="round" />
      <circle {...logo.zero} stroke="var(--on-ink)" strokeWidth={logo.stroke} />
    </svg>
  )
}

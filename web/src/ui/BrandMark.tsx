import { logo } from '../logo.ts'

// tone：auto 跟随深浅色；white 放在外框的深色底上；black 放在 static white 的浅色底上
export function BrandMark({ size = 24, tone = 'auto' }: { size?: number; tone?: 'auto' | 'white' | 'black' }) {
  const [ink, onInk] = {
    auto: ['var(--neutral-background-color-default)', 'var(--gray-25)'],
    white: ['var(--white)', 'var(--frame-background-color)'],
    black: ['var(--black)', 'var(--white)'],
  }[tone]
  return (
    <svg width={size} height={size} viewBox={`0 0 ${logo.size} ${logo.size}`} fill="none" aria-hidden>
      <rect width={logo.size} height={logo.size} rx={logo.radius} fill={ink} />
      <path d={logo.one} stroke={onInk} strokeWidth={logo.stroke} strokeLinecap="round" />
      <circle {...logo.zero} stroke={onInk} strokeWidth={logo.stroke} />
    </svg>
  )
}

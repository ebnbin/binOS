export function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect width="24" height="24" rx="7" fill="var(--ink)" />
      <path d="M8.25 5.75v10.5" stroke="var(--on-ink)" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="12.6" cy="14.1" r="3.9" stroke="var(--on-ink)" strokeWidth="2.4" />
    </svg>
  )
}

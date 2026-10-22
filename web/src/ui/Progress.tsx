import '@material/web/progress/linear-progress.js'
export function Progress({
  value,
  max = 1,
  className,
  'aria-label': label,
}: {
  value?: number
  max?: number
  className?: string
  'aria-label'?: string
}) {
  return (
    <md-linear-progress
      className={className}
      aria-label={label}
      indeterminate={value === undefined}
      value={Math.min(1, Math.max(0, (value ?? 0) / Math.max(1, max)))}
    />
  )
}

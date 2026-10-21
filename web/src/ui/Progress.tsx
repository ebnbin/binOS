import { LinearProgress } from '@mui/material'
import type { LinearProgressProps } from '@mui/material'

export function Progress({
  value,
  max = 1,
  color = 'primary',
  className,
  'aria-label': label,
}: {
  value?: number
  max?: number
  color?: LinearProgressProps['color']
  className?: string
  'aria-label'?: string
}) {
  return (
    <LinearProgress
      className={className}
      color={color}
      aria-label={label}
      variant={value === undefined ? 'indeterminate' : 'determinate'}
      value={value === undefined ? undefined : Math.min(100, Math.max(0, (value / Math.max(max, 1)) * 100))}
    />
  )
}

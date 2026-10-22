import type { ReactNode } from 'react'
import { Button } from './Controls.tsx'
import styles from './SegmentedControl.module.css'

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onValueChange,
  className,
}: {
  label: string
  value: T
  options: { value: T; label: ReactNode }[]
  onValueChange: (value: T) => void
  className?: string
}) {
  return (
    <div role="group" aria-label={label} className={`${styles.group} ${className ?? ''}`}>
      {options.map((option, index) => (
        <Button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          tabIndex={option.value === value ? 0 : -1}
          className={styles.segment}
          onClick={() => onValueChange(option.value)}
          onKeyDown={(event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
            event.preventDefault()
            const next =
              event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? options.length - 1
                  : (index + (event.key === 'ArrowLeft' ? -1 : 1) + options.length) % options.length
            onValueChange(options[next].value)
            event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus()
          }}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}

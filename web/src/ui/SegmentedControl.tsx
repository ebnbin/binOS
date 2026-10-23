import type { Icon } from '@primer/octicons-react'
import type { ReactNode } from 'react'
import styles from './SegmentedControl.module.css'

type Segment<T extends string> = { value: T; label: ReactNode; icon?: Icon; ariaLabel?: string; trailing?: ReactNode }

export function SegmentedControl<T extends string>({ value, segments, onChange, label, size = 'medium', block, className }: {
  value: T
  segments: Segment<T>[]
  onChange: (value: T) => void
  label: string
  size?: 'small' | 'medium'
  block?: boolean
  className?: string
}) {
  return (
    <ul className={`${styles.control} ${className ?? ''}`} aria-label={label} data-size={size} data-block={block || undefined}>
      {segments.map(({ value: segment, label: text, icon: Leading, ariaLabel, trailing }) => (
        <li key={segment} className={styles.item}>
          <button type="button" className={styles.button} aria-current={segment === value} aria-label={ariaLabel} onClick={() => onChange(segment)}>
            <span>
              {Leading && <span className={styles.visual}><Leading size={16} /></span>}
              {text}
              {trailing}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

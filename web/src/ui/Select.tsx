import { ChevronDown } from 'lucide-react'
import styles from './Select.module.css'

type Option = { value: string; label: string; disabled?: boolean }
export function Select({
  value,
  options,
  onValueChange,
  label,
  title,
  disabled,
  className,
}: {
  value: string
  options: Option[]
  onValueChange: (value: string) => void
  label: string
  title?: string
  disabled?: boolean
  className?: string
}) {
  return (
    <span className={`${styles.field} ${className ?? ''}`} data-disabled={disabled || undefined}>
      <select
        className={styles.select}
        aria-label={label}
        title={title}
        value={value}
        disabled={disabled}
        onChange={(event) => onValueChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className={styles.indicator} size={12} aria-hidden="true" />
    </span>
  )
}

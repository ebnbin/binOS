import { NativeSelect } from './Controls.tsx'
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
    <NativeSelect
      className={`${styles.trigger} ${className ?? ''}`}
      value={value}
      aria-label={label}
      title={title}
      disabled={disabled}
      onChange={(event) => onValueChange(event.target.value)}
    >
      {!options.some((option) => option.value === value) && <option value={value} hidden />}
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </NativeSelect>
  )
}

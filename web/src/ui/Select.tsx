import { MenuItem, Select as MaterialSelect } from '@mui/material'

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
  const selectedValue = options.some((option) => option.value === value) ? value : ''
  return (
    <MaterialSelect<string>
      value={selectedValue}
      displayEmpty
      size="small"
      title={title}
      disabled={disabled}
      className={className}
      inputProps={{ 'aria-label': label }}
      onChange={(event) => onValueChange(event.target.value)}
      MenuProps={{ slotProps: { paper: { sx: { maxHeight: 'min(480px, 70dvh)' } } } }}
    >
      {options.map((option) => (
        <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </MenuItem>
      ))}
    </MaterialSelect>
  )
}

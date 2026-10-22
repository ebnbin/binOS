import { style } from '@react-spectrum/s2/style' with { type: 'macro' }
import { Picker, PickerItem } from '@react-spectrum/s2'

type Option = { value: string; label: string; disabled?: boolean }

export function Select({
  value,
  options,
  onValueChange,
  label,
  title,
  disabled,
  className,
  quiet,
}: {
  value: string
  options: Option[]
  onValueChange: (value: string) => void
  label: string
  title?: string
  quiet?: boolean
  disabled?: boolean
  className?: string
}) {
  return (
    <Picker
      size="S"
      isQuiet={quiet}
      styles={style({ width: 'auto', maxWidth: 'full', minWidth: 0 })}
      aria-label={label}
      aria-description={title}
      value={`option:${value}`}
      onChange={(key) => {
        if (key !== null) onValueChange(String(key).slice(7))
      }}
      isDisabled={disabled}
      UNSAFE_className={className}
    >
      {options.map((option) => (
        <PickerItem key={option.value} id={`option:${option.value}`} isDisabled={option.disabled}>
          {option.label}
        </PickerItem>
      ))}
    </Picker>
  )
}

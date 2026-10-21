import { Dropdown, Option } from '@fluentui/react-components'

type SelectOption = { value: string; label: string; disabled?: boolean }

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
  options: SelectOption[]
  onValueChange: (value: string) => void
  label: string
  title?: string
  disabled?: boolean
  className?: string
}) {
  return (
    <Dropdown
      aria-label={label}
      title={title}
      disabled={disabled}
      className={className}
      size="small"
      style={{ minWidth: 0 }}
      value={options.find((option) => option.value === value)?.label ?? ''}
      selectedOptions={[value]}
      onOptionSelect={(_, data) => {
        if (data.optionValue !== undefined) onValueChange(data.optionValue)
      }}
    >
      {options.map((option) => (
        <Option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </Option>
      ))}
    </Dropdown>
  )
}

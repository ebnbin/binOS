import { Select as RadixSelect } from '@radix-ui/themes'

type Option = { value: string; label: string; disabled?: boolean }

export function Select({
  value,
  options,
  onValueChange,
  label,
  title,
  disabled,
  className,
  compact,
}: {
  value: string
  options: Option[]
  onValueChange: (value: string) => void
  label: string
  title?: string
  compact?: boolean
  disabled?: boolean
  className?: string
}) {
  return (
    <RadixSelect.Root
      size={compact ? '2' : { initial: '3', sm: '2' }}
      value={`option:${value}`}
      onValueChange={(key) => onValueChange(key.slice(7))}
      disabled={disabled}
    >
      <RadixSelect.Trigger
        variant={compact ? 'ghost' : 'surface'}
        aria-label={label}
        title={title}
        className={className}
      />
      <RadixSelect.Content position="popper" sideOffset={6} collisionPadding={12}>
        {options.map((option) => (
          <RadixSelect.Item key={option.value} value={`option:${option.value}`} disabled={option.disabled}>
            {option.label}
          </RadixSelect.Item>
        ))}
      </RadixSelect.Content>
    </RadixSelect.Root>
  )
}

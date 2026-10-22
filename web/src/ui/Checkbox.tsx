import { Checkbox as RadixCheckbox, Text } from '@radix-ui/themes'

export function Checkbox({
  checked,
  onCheckedChange,
  label,
  disabled,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <Text
      as="label"
      size="2"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', whiteSpace: 'nowrap' }}
    >
      <RadixCheckbox
        disabled={disabled}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      {label}
    </Text>
  )
}

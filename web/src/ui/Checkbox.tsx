import { Checkbox as FluentCheckbox } from '@fluentui/react-components'

export function Checkbox({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: string
}) {
  return <FluentCheckbox checked={checked} onChange={(_, data) => onCheckedChange(data.checked === true)} label={label} />
}

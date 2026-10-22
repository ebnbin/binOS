import { Checkbox as SpectrumCheckbox } from '@react-spectrum/s2'

export function Checkbox({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: string
}) {
  return (
    <SpectrumCheckbox isSelected={checked} onChange={onCheckedChange}>
      {label}
    </SpectrumCheckbox>
  )
}

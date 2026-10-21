import { Checkbox as MaterialCheckbox, FormControlLabel } from '@mui/material'

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
    <FormControlLabel
      sx={{ margin: 0 }}
      control={<MaterialCheckbox checked={checked} onChange={(_, value) => onCheckedChange(value)} />}
      label={label}
    />
  )
}

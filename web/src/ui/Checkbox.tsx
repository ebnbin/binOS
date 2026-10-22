import { Input } from './Controls.tsx'
import styles from './Checkbox.module.css'

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
    <label className={styles.label}>
      <Input type="checkbox" className={styles.control} checked={checked} onChange={(event) => onCheckedChange(event.target.checked)} />
      {label}
    </label>
  )
}

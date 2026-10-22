import '@material/web/checkbox/checkbox.js'
import type { MdCheckbox } from '@material/web/checkbox/checkbox.js'
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
      <md-checkbox
        checked={checked}
        aria-label={label}
        onchange={(event) => onCheckedChange((event.currentTarget as MdCheckbox).checked)}
      />
      {label}
    </label>
  )
}

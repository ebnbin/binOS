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
      <input type="checkbox" className={styles.control} checked={checked} onChange={(event) => onCheckedChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

import * as Primitive from '@radix-ui/react-checkbox'
import { CheckIcon } from '@primer/octicons-react'
import styles from './Checkbox.module.css'

// Primer FormControl 里的 Checkbox：半粗体标签，下面可以有一行说明
export function Checkbox({ checked, onCheckedChange, label, caption, disabled }: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: string
  caption?: string
  disabled?: boolean
}) {
  return (
    <label className={styles.label} data-disabled={disabled || undefined}>
      <Primitive.Root className={styles.control} checked={checked} disabled={disabled} onCheckedChange={(value) => onCheckedChange(value === true)}>
        <Primitive.Indicator className={styles.indicator}><CheckIcon size={12} /></Primitive.Indicator>
      </Primitive.Root>
      <span className={styles.text}>
        {label}
        {caption && <small className={styles.caption}>{caption}</small>}
      </span>
    </label>
  )
}

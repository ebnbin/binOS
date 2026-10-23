import { CheckmarkFilled } from '@fluentui/react-icons/headless/svg/checkmark'
import * as Primitive from '@radix-ui/react-checkbox'
import styles from './Checkbox.module.css'

export function Checkbox({ checked, onCheckedChange, label, disabled }: { checked: boolean; onCheckedChange: (checked: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className={styles.label} data-disabled={disabled || undefined}>
      <Primitive.Root className={styles.control} checked={checked} disabled={disabled} onCheckedChange={(value) => onCheckedChange(value === true)}>
        <Primitive.Indicator className={styles.indicator}><CheckmarkFilled /></Primitive.Indicator>
      </Primitive.Root>
      {label}
    </label>
  )
}

import * as Primitive from '@radix-ui/react-checkbox'
import { UiIcon } from './UiIcon.tsx'
import styles from './Checkbox.module.css'

// Spectrum 2 的 checkbox：16px 的方框，2px 边框；选中后是深色底和反白的勾
export function Checkbox({ checked, onCheckedChange, label }: { checked: boolean; onCheckedChange: (checked: boolean) => void; label: string }) {
  return (
    <label className={styles.label}>
      <Primitive.Root className={styles.control} checked={checked} onCheckedChange={(value) => onCheckedChange(value === true)}>
        <Primitive.Indicator className={styles.indicator}><UiIcon glyph="checkmark" /></Primitive.Indicator>
      </Primitive.Root>
      {label}
    </label>
  )
}

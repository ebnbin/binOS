import * as Primitive from '@radix-ui/react-select'
import { UiIcon } from './UiIcon.tsx'
import menu from './Menu.module.css'
import styles from './Select.module.css'

type Option = { value: string; label: string; disabled?: boolean }

// Spectrum 2 的 picker：浅灰底的按钮，弹出的列表和菜单一致，选中项前面是 accent 色的勾
export function Select({ value, options, onValueChange, label, title, disabled, size = 'M', quiet, className }: {
  value: string
  options: Option[]
  onValueChange: (value: string) => void
  label: string
  title?: string
  disabled?: boolean
  size?: 'S' | 'M'
  quiet?: boolean
  className?: string
}) {
  // Radix 的空字符串用于清除选择；加前缀让业务里的默认选项也能被选中。
  const encode = (value: string) => `option:${value}`
  return (
    <Primitive.Root value={encode(value)} onValueChange={(next) => onValueChange(next.slice(7))} disabled={disabled}>
      <Primitive.Trigger aria-label={label} title={title} className={`${styles.trigger} ${className ?? ''}`} data-size={size} data-quiet={quiet || undefined}>
        <span className={styles.value}><Primitive.Value /></span>
        <Primitive.Icon className={styles.icon}><UiIcon glyph="chevron" direction="down" /></Primitive.Icon>
      </Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Content className={`${menu.menu} ${styles.content}`} position="popper" sideOffset={6} collisionPadding={8}>
          <Primitive.ScrollUpButton className={styles.scroll}><UiIcon glyph="chevron" direction="up" /></Primitive.ScrollUpButton>
          <Primitive.Viewport>
            {options.map((option) => (
              <Primitive.Item key={option.value} value={encode(option.value)} disabled={option.disabled} className={menu.item}>
                <span className={menu.checkmark}><Primitive.ItemIndicator><UiIcon glyph="checkmark" /></Primitive.ItemIndicator></span>
                <span className={menu.label}><Primitive.ItemText>{option.label}</Primitive.ItemText></span>
              </Primitive.Item>
            ))}
          </Primitive.Viewport>
          <Primitive.ScrollDownButton className={styles.scroll}><UiIcon glyph="chevron" direction="down" /></Primitive.ScrollDownButton>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  )
}

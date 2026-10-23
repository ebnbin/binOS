import { CheckmarkFilled } from '@fluentui/react-icons/headless/svg/checkmark'
import { ChevronDownRegular } from '@fluentui/react-icons/headless/svg/chevron-down'
import { ChevronUpRegular } from '@fluentui/react-icons/headless/svg/chevron-up'
import * as Primitive from '@radix-ui/react-select'
import styles from './Select.module.css'
import surface from './Surface.module.css'

type Option = { value: string; label: string; disabled?: boolean }

// Fluent 2 的 Dropdown：触发器和 Input 一样，弹出的列表是 Acrylic 表面，选中项前面有勾
export function Select({ value, options, onValueChange, label, title, disabled, className, size = 'medium', appearance = 'outline' }: {
  value: string
  options: Option[]
  onValueChange: (value: string) => void
  label: string
  title?: string
  disabled?: boolean
  className?: string
  size?: 'small' | 'medium'
  appearance?: 'outline' | 'subtle'
}) {
  // Radix 的空字符串用于清除选择；加前缀让业务里的默认选项也能被选中。
  const encode = (value: string) => `option:${value}`
  return (
    <Primitive.Root value={encode(value)} onValueChange={(next) => onValueChange(next.slice(7))} disabled={disabled}>
      <Primitive.Trigger aria-label={label} title={title} className={`${styles.trigger} ${className ?? ''}`} data-size={size} data-appearance={appearance}>
        <span className={styles.value}><Primitive.Value /></span>
        <Primitive.Icon className={styles.icon}><ChevronDownRegular /></Primitive.Icon>
      </Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Content className={`${surface.surface} ${styles.content}`} position="popper" sideOffset={4} collisionPadding={8}>
          <Primitive.ScrollUpButton className={styles.scroll}><ChevronUpRegular /></Primitive.ScrollUpButton>
          <Primitive.Viewport className={styles.viewport}>
            {options.map((option) => (
              <Primitive.Item key={option.value} value={encode(option.value)} disabled={option.disabled} className={surface.item}>
                <span className={styles.check} aria-hidden>
                  <Primitive.ItemIndicator><CheckmarkFilled /></Primitive.ItemIndicator>
                </span>
                <Primitive.ItemText>{option.label}</Primitive.ItemText>
              </Primitive.Item>
            ))}
          </Primitive.Viewport>
          <Primitive.ScrollDownButton className={styles.scroll}><ChevronDownRegular /></Primitive.ScrollDownButton>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  )
}

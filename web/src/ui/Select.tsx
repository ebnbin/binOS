import * as Primitive from '@radix-ui/react-select'
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, TriangleDownIcon } from '@primer/octicons-react'
import { buttonProps } from './button-props.ts'
import type { ButtonSize, ButtonVariant } from './button-props.ts'
import button from './Button.module.css'
import list from './ActionList.module.css'
import overlay from './Overlay.module.css'
import styles from './Select.module.css'

type Option = { value: string; label: string; description?: string; disabled?: boolean }

// Primer 的单选 ActionMenu：按钮显示当前值，右侧是下三角；选项是 ActionList，选中项前面打勾
export function Select({ value, options, onValueChange, label, title, disabled, className, size = 'small', variant = 'default', side, align = 'start' }: {
  value: string
  options: Option[]
  onValueChange: (value: string) => void
  label: string
  title?: string
  disabled?: boolean
  className?: string
  size?: ButtonSize
  variant?: ButtonVariant
  side?: 'top' | 'bottom'
  align?: 'start' | 'end'
}) {
  // Radix 的空字符串用于清除选择；加前缀让业务里的默认选项也能被选中。
  const encode = (value: string) => `option:${value}`
  return (
    <Primitive.Root value={encode(value)} onValueChange={(next) => onValueChange(next.slice(7))} disabled={disabled}>
      <Primitive.Trigger aria-label={label} title={title} {...buttonProps({ variant, size }, `${styles.trigger} ${className ?? ''}`)}>
        <span className={`${button.label} ${styles.value}`}><Primitive.Value /></span>
        <Primitive.Icon className={button.trailingAction}><TriangleDownIcon size={16} /></Primitive.Icon>
      </Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Content className={`${overlay.overlay} ${styles.content}`} position="popper" side={side} align={align} sideOffset={4} collisionPadding={8}>
          <Primitive.ScrollUpButton className={styles.scroll}><ChevronUpIcon size={16} /></Primitive.ScrollUpButton>
          <Primitive.Viewport className={list.list}>
            {options.map((option) => (
              <Primitive.Item key={option.value} value={encode(option.value)} disabled={option.disabled} className={list.item}>
                <span className={list.visual}>
                  <Primitive.ItemIndicator className={styles.indicator}><CheckIcon size={16} /></Primitive.ItemIndicator>
                </span>
                <span className={list.content}>
                  <Primitive.ItemText>{option.label}</Primitive.ItemText>
                  {option.description && <span className={list.description}>{option.description}</span>}
                </span>
              </Primitive.Item>
            ))}
          </Primitive.Viewport>
          <Primitive.ScrollDownButton className={styles.scroll}><ChevronDownIcon size={16} /></Primitive.ScrollDownButton>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  )
}

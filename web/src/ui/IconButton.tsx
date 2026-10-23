import type { Icon as IconType } from '@primer/octicons-react'
import type { ButtonHTMLAttributes, Ref } from 'react'
import { buttonProps } from './button-props.ts'
import type { ButtonSize, ButtonVariant } from './button-props.ts'
import styles from './Button.module.css'
import { Tooltip } from './Tooltip.tsx'

// Primer IconButton：没有文字的按钮必须有标签，悬停或聚焦时用 Tooltip 显示；tooltip 可以比标签多一句说明
export function IconButton({
  icon: Icon,
  label,
  tooltip = label,
  variant = 'invisible',
  size = 'medium',
  className,
  ref,
  ...props
}: { icon: IconType; label: string; tooltip?: string; variant?: ButtonVariant; size?: ButtonSize; ref?: Ref<HTMLButtonElement> } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Tooltip text={tooltip}>
      <button ref={ref} type="button" aria-label={label} {...buttonProps({ variant, size }, className)} data-icon-only="" {...props}>
        <span className={styles.visual}><Icon size={16} /></span>
      </button>
    </Tooltip>
  )
}

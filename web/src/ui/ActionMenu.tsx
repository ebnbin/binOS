import * as Dropdown from '@radix-ui/react-dropdown-menu'
import type { Icon } from '@primer/octicons-react'
import type { ReactElement, ReactNode } from 'react'
import list from './ActionList.module.css'
import overlay from './Overlay.module.css'

// Primer ActionMenu：按钮打开的 ActionList 浮层
export function ActionMenu({
  trigger,
  label,
  children,
  side = 'bottom',
  align = 'end',
  onOpenChange,
}: {
  trigger: ReactElement
  label: string
  children: ReactNode
  side?: 'top' | 'bottom'
  align?: 'start' | 'end'
  onOpenChange?: (open: boolean) => void
}) {
  return (
    <Dropdown.Root modal={false} onOpenChange={onOpenChange}>
      <Dropdown.Trigger asChild>{trigger}</Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content aria-label={label} side={side} align={align} sideOffset={4} collisionPadding={8} className={overlay.overlay}>
          <div className={list.list}>{children}</div>
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  )
}

export function ActionMenuItem({
  icon: Leading,
  children,
  description,
  variant,
  disabled,
  onSelect,
}: {
  icon?: Icon
  children: ReactNode
  description?: ReactNode
  variant?: 'danger'
  disabled?: boolean
  onSelect: () => void
}) {
  return (
    <Dropdown.Item className={list.item} data-variant={variant} disabled={disabled} onSelect={onSelect}>
      {Leading && <span className={list.visual}><Leading size={16} /></span>}
      <span className={list.content}>
        <span className={list.label}>{children}</span>
        {description && <span className={list.description}>{description}</span>}
      </span>
    </Dropdown.Item>
  )
}

export function ActionMenuDivider() {
  return <Dropdown.Separator className={list.divider} />
}

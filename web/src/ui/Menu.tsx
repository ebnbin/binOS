import * as Primitive from '@radix-ui/react-dropdown-menu'
import type { ComponentProps, ReactElement, ReactNode } from 'react'
import styles from './Menu.module.css'
import surface from './Surface.module.css'

// Fluent 2 的 Menu：Radix 的 DropdownMenu 加上 Acrylic 表面
export function Menu({
  trigger,
  label,
  children,
  open,
  onOpenChange,
  align = 'start',
  ...props
}: {
  trigger: ReactElement
  label: string
  children: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  align?: 'start' | 'end'
} & Pick<ComponentProps<typeof Primitive.Content>, 'onCloseAutoFocus'> & { modal?: boolean }) {
  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange} modal={props.modal}>
      <Primitive.Trigger asChild>{trigger}</Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Content
          className={`${surface.surface} ${styles.menu}`}
          align={align}
          sideOffset={4}
          collisionPadding={12}
          aria-label={label}
          onCloseAutoFocus={props.onCloseAutoFocus}
        >
          {children}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  )
}

export function MenuItem({ icon, children, ...props }: { icon?: ReactNode; children: ReactNode } & Omit<ComponentProps<typeof Primitive.Item>, 'className' | 'children'>) {
  return (
    <Primitive.Item className={surface.item} {...props}>
      {icon && <span className={surface.itemIcon}>{icon}</span>}
      {children}
    </Primitive.Item>
  )
}

export function MenuDivider() {
  return <Primitive.Separator className={surface.divider} />
}

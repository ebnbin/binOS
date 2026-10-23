import * as Primitive from '@radix-ui/react-popover'
import type { ReactElement, ReactNode } from 'react'
import styles from './Overlay.module.css'

// 锚定在按钮上的 Primer Overlay
export function Popover({
  trigger,
  label,
  children,
  open,
  onOpenChange,
  className,
  side = 'bottom',
  align = 'end',
}: {
  trigger: ReactElement
  label: string
  children: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
  side?: 'top' | 'bottom'
  align?: 'start' | 'end'
}) {
  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      <Primitive.Trigger asChild>{trigger}</Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Content
          aria-label={label}
          side={side}
          align={align}
          sideOffset={4}
          collisionPadding={8}
          className={`${styles.overlay} ${className ?? ''}`}
        >
          {children}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  )
}

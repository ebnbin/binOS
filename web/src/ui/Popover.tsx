import { Popover as RadixPopover } from '@radix-ui/themes'
import type { ReactElement, ReactNode } from 'react'

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
    <RadixPopover.Root open={open} onOpenChange={onOpenChange}>
      <RadixPopover.Trigger>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Content
        aria-label={label}
        side={side}
        align={align}
        sideOffset={8}
        collisionPadding={12}
        className={className}
      >
        {children}
      </RadixPopover.Content>
    </RadixPopover.Root>
  )
}

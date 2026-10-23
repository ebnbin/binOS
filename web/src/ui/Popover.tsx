import { Popover as Base } from '@radix-ui/themes'
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
  size = '2',
}: {
  trigger: ReactElement
  label: string
  children: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
  side?: 'top' | 'bottom'
  align?: 'start' | 'end'
  size?: '1' | '2' | '3' | '4'
}) {
  return (
    <Base.Root open={open} onOpenChange={onOpenChange}>
      <Base.Trigger>{trigger}</Base.Trigger>
      <Base.Content aria-label={label} side={side} align={align} sideOffset={8} collisionPadding={12} size={size} className={className}>
        {children}
      </Base.Content>
    </Base.Root>
  )
}

import { Popover as FluentPopover, PopoverSurface, PopoverTrigger } from '@fluentui/react-components'
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
    <FluentPopover
      open={open}
      onOpenChange={(_, data) => onOpenChange?.(data.open)}
      positioning={{ position: side === 'top' ? 'above' : 'below', align, offset: 8 }}
    >
      <PopoverTrigger disableButtonEnhancement>{trigger}</PopoverTrigger>
      <PopoverSurface aria-label={label} className={className}>
        {children}
      </PopoverSurface>
    </FluentPopover>
  )
}

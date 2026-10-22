import { DialogTrigger, Popover as SpectrumPopover } from '@react-spectrum/s2'
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
    <DialogTrigger isOpen={open} onOpenChange={onOpenChange}>
      {trigger}
      <SpectrumPopover aria-label={label} placement={`${side} ${align}`} UNSAFE_className={className} hideArrow>
        {children}
      </SpectrumPopover>
    </DialogTrigger>
  )
}

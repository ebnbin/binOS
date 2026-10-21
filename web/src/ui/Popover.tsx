import { Popover as MaterialPopover } from '@mui/material'
import { cloneElement, useState } from 'react'
import type { MouseEventHandler, ReactElement, ReactNode } from 'react'

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
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [localOpen, setLocalOpen] = useState(false)
  const visible = open ?? localOpen
  const change = (next: boolean) => {
    setLocalOpen(next)
    onOpenChange?.(next)
  }
  const button = trigger as ReactElement<{ onClick?: MouseEventHandler<HTMLElement> }>
  const horizontal = align === 'start' ? 'left' : 'right'
  return (
    <>
      {cloneElement(button, {
        onClick: (event) => {
          button.props.onClick?.(event)
          setAnchor(event.currentTarget)
          change(!visible)
        },
      })}
      <MaterialPopover
        open={visible}
        anchorEl={anchor}
        onClose={() => change(false)}
        anchorOrigin={{ vertical: side === 'top' ? 'top' : 'bottom', horizontal }}
        transformOrigin={{ vertical: side === 'top' ? 'bottom' : 'top', horizontal }}
        slotProps={{
          paper: {
            className,
            role: 'dialog',
            'aria-label': label,
            tabIndex: -1,
            sx: { marginTop: side === 'top' ? '-8px' : '8px', maxWidth: 'calc(100vw - 24px)', maxHeight: 'min(640px, 75dvh)', padding: 2 },
          },
        }}
      >
        {children}
      </MaterialPopover>
    </>
  )
}

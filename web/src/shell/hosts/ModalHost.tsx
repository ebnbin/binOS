import { Dialog } from '@mui/material'
import type { ReactNode } from 'react'

export function ModalHost({
  label,
  className,
  onClose,
  children,
  dismissible = true,
}: {
  label: string
  className?: string
  onClose(): void
  children: ReactNode
  dismissible?: boolean
}) {
  return (
    <Dialog
      open
      aria-label={label}
      onClose={() => {
        if (dismissible) onClose()
      }}
      slotProps={{ paper: { className, 'aria-label': label } }}
    >
      {children}
    </Dialog>
  )
}

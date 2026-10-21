import { Dialog, DialogSurface } from '@fluentui/react-components'
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
      modalType="modal"
      onOpenChange={(_, data) => {
        if (!data.open && dismissible) onClose()
      }}
    >
      <DialogSurface aria-label={label} className={className}>
        {children}
      </DialogSurface>
    </Dialog>
  )
}

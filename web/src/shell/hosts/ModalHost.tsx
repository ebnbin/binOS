import { Dialog, VisuallyHidden } from '@radix-ui/themes'
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
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && dismissible) onClose()
      }}
    >
      <Dialog.Content
        className={className}
        aria-describedby={undefined}
        onEscapeKeyDown={(event) => {
          if (!dismissible) event.preventDefault()
        }}
        onInteractOutside={(event) => {
          if (!dismissible) event.preventDefault()
        }}
      >
        <VisuallyHidden>
          <Dialog.Title>{label}</Dialog.Title>
        </VisuallyHidden>
        {children}
      </Dialog.Content>
    </Dialog.Root>
  )
}

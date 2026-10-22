import { Content, Dialog, DialogContainer } from '@react-spectrum/s2'
import { style } from '@react-spectrum/s2/style' with { type: 'macro' }
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
    <DialogContainer onDismiss={onClose}>
      <Dialog
        aria-label={label}
        UNSAFE_className={className}
        size="L"
        isDismissible={dismissible}
        isKeyboardDismissDisabled={!dismissible}
      >
        <Content styles={style({ padding: 0, minHeight: 0, overflow: 'auto', flexGrow: 1 })}>{children}</Content>
      </Dialog>
    </DialogContainer>
  )
}

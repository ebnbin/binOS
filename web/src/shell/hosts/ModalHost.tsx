import { Dialog, VisuallyHidden } from '@radix-ui/themes'
import type { ReactNode } from 'react'

// Radix Themes 的对话框。dismissible 为 false 时，Esc 和点遮罩都不关闭
export function ModalHost({
  label,
  className,
  onClose,
  children,
  dismissible = true,
  size = '3',
  maxWidth = '600px',
}: {
  label: string
  className?: string
  onClose(): void
  children: ReactNode
  dismissible?: boolean
  size?: '1' | '2' | '3' | '4'
  maxWidth?: string
}) {
  const keepOpen = dismissible ? undefined : (event: Event) => event.preventDefault()
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Content size={size} maxWidth={maxWidth} className={className} aria-describedby={undefined} onEscapeKeyDown={keepOpen} onPointerDownOutside={keepOpen}>
        <VisuallyHidden>
          <Dialog.Title>{label}</Dialog.Title>
        </VisuallyHidden>
        {children}
      </Dialog.Content>
    </Dialog.Root>
  )
}

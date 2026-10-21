import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

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
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    dialog.current?.showModal()
  }, [])
  return createPortal(
    <dialog
      ref={dialog}
      className={className}
      aria-label={label}
      onClose={onClose}
      onCancel={(event) => {
        if (!dismissible) event.preventDefault()
      }}
      onClick={(event) => {
        if (dismissible && event.target === dialog.current) onClose()
      }}
    >
      {children}
    </dialog>,
    document.body,
  )
}

import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import dialogStyles from '../../ui/Dialog.module.css'

// 不给 className 时是 Fluent 2 的 Dialog 表面；给了就完全由调用方决定，可以 composes Dialog.module.css 的 surface
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
      className={className ?? dialogStyles.surface}
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

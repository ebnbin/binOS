import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function ModalHost({ label, className, onClose, children }: {
  label: string
  className?: string
  onClose(): void
  children: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { dialog.current?.showModal() }, [])
  return createPortal(
    <dialog ref={dialog} className={className} aria-label={label} onClose={onClose}
      onClick={(event) => { if (event.target === dialog.current) onClose() }}>
      {children}
    </dialog>, document.body,
  )
}

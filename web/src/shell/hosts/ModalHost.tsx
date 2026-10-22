import { useReducedMotion } from '../../ui/useReducedMotion.ts'
import '@material/web/dialog/dialog.js'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import styles from './ModalHost.module.css'

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
  const quick = useReducedMotion()
  return createPortal(
    <md-dialog
      quick={quick}
      open
      aria-label={label}
      className={`${styles.dialog} ${className ?? ''}`}
      oncancel={(event) => {
        if (!dismissible) event.preventDefault()
      }}
      onclosed={onClose}
    >
      <div slot="content" className={styles.content}>
        {children}
      </div>
    </md-dialog>,
    document.body,
  )
}

import type { LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'
import styles from './IconButton.module.css'

export function IconButton({
  icon: Icon,
  label,
  className,
  ...props
}: { icon: LucideIcon; label: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" aria-label={label} title={label} className={`${styles.button} ${className ?? ''}`} {...props}>
      <Icon size={19} strokeWidth={1.7} aria-hidden="true" />
    </button>
  )
}

import type { Icon } from '@primer/octicons-react'
import type { InputHTMLAttributes, ReactNode, Ref } from 'react'
import styles from './TextInput.module.css'

export function TextInput({
  leadingVisual: Leading,
  trailingAction,
  size = 'medium',
  block,
  className,
  ref,
  ...props
}: {
  leadingVisual?: Icon
  trailingAction?: ReactNode
  size?: 'small' | 'medium' | 'large'
  block?: boolean
  ref?: Ref<HTMLInputElement>
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>) {
  return (
    <span className={`${styles.input} ${className ?? ''}`} data-size={size} data-block={block || undefined} data-disabled={props.disabled || undefined}>
      {Leading && <span className={styles.visual}><Leading size={16} /></span>}
      <input ref={ref} {...props} />
      {trailingAction && <span className={styles.trailing}>{trailingAction}</span>}
    </span>
  )
}

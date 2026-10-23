import type { InputHTMLAttributes, ReactNode, Ref, TextareaHTMLAttributes } from 'react'
import styles from './Input.module.css'

type Appearance = 'outline' | 'filled-darker' | 'filled-lighter' | 'underline'

// Fluent 2 的 Input：外框是 span，聚焦时底边从中间展开一条品牌色线。className 加在外框上，其余属性给 input
export function Input({
  className,
  contentBefore,
  contentAfter,
  size = 'medium',
  appearance = 'outline',
  ref,
  ...props
}: {
  contentBefore?: ReactNode
  contentAfter?: ReactNode
  size?: 'small' | 'medium' | 'large'
  appearance?: Appearance
  ref?: Ref<HTMLInputElement>
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>) {
  return (
    <span className={`${styles.root} ${className ?? ''}`} data-size={size} data-appearance={appearance} data-disabled={props.disabled || undefined} data-invalid={props['aria-invalid'] || undefined}>
      {contentBefore && <span className={styles.content}>{contentBefore}</span>}
      <input ref={ref} className={styles.input} {...props} />
      {contentAfter && <span className={styles.content}>{contentAfter}</span>}
    </span>
  )
}

export function Textarea({
  className,
  appearance = 'outline',
  ref,
  ...props
}: { appearance?: Appearance; ref?: Ref<HTMLTextAreaElement> } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <span className={`${styles.root} ${styles.textareaRoot} ${className ?? ''}`} data-appearance={appearance} data-disabled={props.disabled || undefined} data-invalid={props['aria-invalid'] || undefined}>
      <textarea ref={ref} className={styles.textarea} {...props} />
    </span>
  )
}

import type { ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react'
import type { Ref } from 'react'
import styles from './Controls.module.css'

export function Button({
  className,
  type,
  variant = 'plain',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { ref?: Ref<HTMLButtonElement>; variant?: 'plain' | 'filled' | 'tinted' | 'destructive' }) {
  return <button type={type} className={`${styles.button} ${styles[variant] ?? ''} ${className ?? ''}`} {...props} />
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return <input className={`${styles.input} ${className ?? ''}`} {...props} />
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
  return <textarea className={`${styles.input} ${styles.textarea} ${className ?? ''}`} {...props} />
}

export function NativeSelect({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${styles.select} ${className ?? ''}`} {...props} />
}

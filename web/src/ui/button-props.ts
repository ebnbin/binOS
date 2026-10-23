import styles from './Button.module.css'

export type ButtonVariant = 'default' | 'primary' | 'danger' | 'invisible'
export type ButtonSize = 'small' | 'medium' | 'large'

// Button 的类名和 data 属性，给需要按钮外观的其他元素（如 Radix 的触发器）用
export function buttonProps({ variant = 'default', size = 'medium', block }: { variant?: ButtonVariant; size?: ButtonSize; block?: boolean }, className?: string) {
  return { className: `${styles.button} ${className ?? ''}`, 'data-variant': variant, 'data-size': size, 'data-block': block || undefined }
}

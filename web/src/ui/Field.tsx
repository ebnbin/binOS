import { CheckmarkCircleFilled } from '@fluentui/react-icons/headless/svg/checkmark-circle'
import { ErrorCircleFilled } from '@fluentui/react-icons/headless/svg/error-circle'
import { WarningFilled } from '@fluentui/react-icons/headless/svg/warning'
import type { ReactNode } from 'react'
import styles from './Field.module.css'

type ValidationState = 'error' | 'warning' | 'success' | 'none'

const validationIcons = { error: ErrorCircleFilled, warning: WarningFilled, success: CheckmarkCircleFilled }

// Fluent 2 的 Field：标签在上，提示和校验信息在下。整个 Field 是一个 label，里面的输入框自动关联
export function Field({
  label,
  hint,
  validationMessage,
  validationState = validationMessage ? 'error' : 'none',
  required,
  className,
  children,
}: {
  label: ReactNode
  hint?: ReactNode
  validationMessage?: ReactNode
  validationState?: ValidationState
  required?: boolean
  className?: string
  children: ReactNode
}) {
  const Icon = validationState === 'none' ? undefined : validationIcons[validationState]
  return (
    <label className={`${styles.field} ${className ?? ''}`}>
      <span className={styles.label}>
        {label}
        {required && <span className={styles.required} aria-hidden>*</span>}
      </span>
      {children}
      {validationMessage && (
        <span className={styles.validation} data-state={validationState} role={validationState === 'error' ? 'alert' : undefined}>
          {Icon && <Icon className={styles.validationIcon} />}
          {validationMessage}
        </span>
      )}
      {hint && <span className={styles.hint}>{hint}</span>}
    </label>
  )
}

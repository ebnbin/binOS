import type { Icon } from '@primer/octicons-react'
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import styles from './Button.module.css'
import { buttonProps } from './button-props.ts'
import type { ButtonSize, ButtonVariant } from './button-props.ts'

type Options = {
  variant?: ButtonVariant
  size?: ButtonSize
  leadingVisual?: Icon
  trailingVisual?: ReactNode
  trailingAction?: Icon
  block?: boolean
}

function Content({ leadingVisual: Leading, trailingVisual, trailingAction: Trailing, children }: Options & { children?: ReactNode }) {
  return (
    <>
      {Leading && <span className={styles.visual}><Leading size={16} /></span>}
      {children !== undefined && children !== null && children !== false && <span className={styles.label}>{children}</span>}
      {trailingVisual !== undefined && <span className={styles.visual}>{trailingVisual}</span>}
      {Trailing && <span className={styles.trailingAction}><Trailing size={16} /></span>}
    </>
  )
}

export function Button({
  variant,
  size,
  leadingVisual,
  trailingVisual,
  trailingAction,
  block,
  className,
  children,
  ref,
  ...props
}: Options & ButtonHTMLAttributes<HTMLButtonElement> & { ref?: Ref<HTMLButtonElement> }) {
  return (
    <button ref={ref} type="button" {...buttonProps({ variant, size, block }, className)} {...props}>
      <Content leadingVisual={leadingVisual} trailingVisual={trailingVisual} trailingAction={trailingAction}>{children}</Content>
    </button>
  )
}

export function LinkButton({
  variant,
  size,
  leadingVisual,
  trailingVisual,
  trailingAction,
  block,
  className,
  children,
  ...props
}: Options & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a {...buttonProps({ variant, size, block }, className)} {...props}>
      <Content leadingVisual={leadingVisual} trailingVisual={trailingVisual} trailingAction={trailingAction}>{children}</Content>
    </a>
  )
}

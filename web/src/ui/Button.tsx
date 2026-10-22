import '@material/web/button/text-button.js'
import '@material/web/button/filled-button.js'
import '@material/web/button/outlined-button.js'
import '@material/web/button/filled-tonal-button.js'
import '@material/web/iconbutton/icon-button.js'
import '@material/web/iconbutton/filled-icon-button.js'
import '@material/web/ripple/ripple.js'
import '@material/web/focus/md-focus-ring.js'
import { Children } from 'react'
import type { ButtonHTMLAttributes, Ref, ElementType } from 'react'
import styles from './Button.module.css'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  ref?: Ref<HTMLElement>
  variant?: 'text' | 'filled' | 'tonal' | 'outlined' | 'surface' | 'icon' | 'filled-icon'
}

export function Button({ children, variant, ref, type, className, onClick, onKeyDown, onPointerDown, onFocus, onBlur, ...props }: Props) {
  if (variant === 'surface')
    return (
      <button
        {...props}
        ref={ref as Ref<HTMLButtonElement>}
        type={type ?? 'button'}
        className={`${styles.surface} ${className ?? ''}`}
        onClick={onClick}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onFocus={onFocus}
        onBlur={onBlur}
      >
        <md-ripple disabled={props.disabled} />
        <md-focus-ring inward />
        {children}
      </button>
    )
  const icon =
    variant === 'icon' ||
    variant === 'filled-icon' ||
    (!variant &&
      Boolean(props['aria-label'] ?? props.title) &&
      !Children.toArray(children).some((child) => typeof child === 'string' || typeof child === 'number'))
  const Tag = icon
    ? variant === 'filled-icon'
      ? 'md-filled-icon-button'
      : 'md-icon-button'
    : variant === 'filled'
      ? 'md-filled-button'
      : variant === 'tonal'
        ? 'md-filled-tonal-button'
        : variant === 'outlined'
          ? 'md-outlined-button'
          : 'md-text-button'
  // The custom element provides the native button behavior and form association.
  const attributes = {
    ...props,
    ...(icon && typeof props['aria-pressed'] === 'boolean' ? { toggle: true, selected: props['aria-pressed'] } : {}),
    'aria-label': props['aria-label'] ?? props.title,
    type: type ?? 'submit',
    className: `${styles.control} ${className ?? ''}`,
    onClick,
    onKeyDown,
    onPointerDown,
    onFocus,
    onBlur,
  }
  const Component = Tag as ElementType
  return (
    <Component {...attributes} ref={ref}>
      {icon ? children : <span className={styles.content}>{children}</span>}
    </Component>
  )
}

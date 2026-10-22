import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './Components.module.css'

export function Button({
  variant = 'secondary',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'plain' | 'destructive' }) {
  return (
    <button type="button" className={`${styles.button} ${className ?? ''}`} data-variant={variant} {...props}>
      {children}
    </button>
  )
}

export function Toolbar({
  label,
  leading,
  children,
  trailing,
  className,
}: {
  label: string
  leading?: ReactNode
  children?: ReactNode
  trailing?: ReactNode
  className?: string
}) {
  return (
    <header className={`${styles.toolbar} ${className ?? ''}`} aria-label={label}>
      {leading && <div className={styles.leading}>{leading}</div>}
      {children && <div className={styles.heading}>{children}</div>}
      {trailing && <div className={styles.trailing}>{trailing}</div>}
    </header>
  )
}

export function NavigationSplitView({
  sidebar,
  children,
  view,
  className,
}: {
  sidebar: ReactNode
  children: ReactNode
  view: 'list' | 'detail'
  className?: string
}) {
  return (
    <div className={`${styles.splitView} ${className ?? ''}`} data-view={view}>
      <aside className={styles.sidebar} aria-label="对话导航">
        {sidebar}
      </aside>
      <main className={styles.detail}>{children}</main>
    </div>
  )
}

export function ContentUnavailable({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className={styles.unavailable}>
      {icon && <span className={styles.symbol}>{icon}</span>}
      <h1>{title}</h1>
      {children && <div className={styles.description}>{children}</div>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}

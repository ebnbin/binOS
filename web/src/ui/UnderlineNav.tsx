import type { Icon } from '@primer/octicons-react'
import type { ReactNode } from 'react'
import { CounterLabel } from './Label.tsx'
import styles from './UnderlineNav.module.css'

type Tab<T extends string> = { value: T; label: ReactNode; icon?: Icon; counter?: ReactNode }

export function UnderlineNav<T extends string>({ value, tabs, onChange, label, className }: {
  value: T
  tabs: Tab<T>[]
  onChange: (value: T) => void
  label: string
  className?: string
}) {
  return (
    <nav className={`${styles.nav} ${className ?? ''}`} aria-label={label}>
      {tabs.map(({ value: tab, label: text, icon: Leading, counter }) => (
        <button key={tab} type="button" className={styles.tab} aria-current={tab === value ? 'page' : undefined} onClick={() => onChange(tab)}>
          {Leading && <span className={styles.icon}><Leading size={16} /></span>}
          {text}
          {counter !== undefined && <CounterLabel>{counter}</CounterLabel>}
        </button>
      ))}
    </nav>
  )
}

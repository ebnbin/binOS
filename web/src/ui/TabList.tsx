import type { ReactNode } from 'react'
import styles from './TabList.module.css'

type Tab<T extends string> = { value: T; label: ReactNode; icon?: ReactNode; title?: string }

// Fluent 2 的 TabList：选中的标签下面（竖排时在左边）有一条品牌色的指示线，文字加粗
export function TabList<T extends string>({ tabs, value, onValueChange, size = 'medium', vertical = false, label, className }: {
  tabs: Tab<T>[]
  value: T
  onValueChange: (value: T) => void
  size?: 'small' | 'medium'
  vertical?: boolean
  label: string
  className?: string
}) {
  return (
    <div className={`${styles.list} ${className ?? ''}`} role="tablist" aria-label={label} aria-orientation={vertical ? 'vertical' : 'horizontal'} data-size={size} data-vertical={vertical || undefined}
      onKeyDown={(event) => {
        const keys = vertical ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight']
        const step = event.key === keys[0] ? -1 : event.key === keys[1] ? 1 : 0
        if (!step) return
        event.preventDefault()
        const next = tabs[(tabs.findIndex((tab) => tab.value === value) + step + tabs.length) % tabs.length]
        onValueChange(next.value)
        event.currentTarget.querySelector<HTMLElement>(`[data-value="${CSS.escape(next.value)}"]`)?.focus()
      }}
    >
      {tabs.map((tab) => (
        <button key={tab.value} type="button" role="tab" className={styles.tab} data-value={tab.value} title={tab.title} aria-selected={tab.value === value} tabIndex={tab.value === value ? 0 : -1} onClick={() => onValueChange(tab.value)}>
          {tab.icon && <span className={styles.icon}>{tab.icon}</span>}
          {/* 隐藏的粗体副本先占好宽度，选中后文字变粗时不跳动 */}
          <span className={styles.content} data-text={typeof tab.label === 'string' ? tab.label : undefined}>{tab.label}</span>
        </button>
      ))}
    </div>
  )
}

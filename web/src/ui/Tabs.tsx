import '@material/web/tabs/tabs.js'
import '@material/web/tabs/primary-tab.js'
import type { MaterialIcon } from './icons.tsx'
import type { ReactNode } from 'react'

export function Tabs<T extends string>({
  label,
  value,
  options,
  onValueChange,
  className,
}: {
  label: string
  value: T
  options: { value: T; label: ReactNode; icon?: MaterialIcon }[]
  onValueChange: (value: T) => void
  className?: string
}) {
  return (
    <md-tabs
      role="tablist"
      className={className}
      aria-label={label}
      activeTabIndex={Math.max(
        0,
        options.findIndex((option) => option.value === value),
      )}
    >
      {options.map(({ value: tabValue, label, icon: Icon }) => (
        <md-primary-tab role="tab" aria-selected={tabValue === value} key={tabValue} onClick={() => onValueChange(tabValue)}>
          {Icon && <Icon slot="icon" />}
          {label}
        </md-primary-tab>
      ))}
    </md-tabs>
  )
}

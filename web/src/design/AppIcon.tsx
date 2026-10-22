import type { CSSProperties } from 'react'
import type { ApplicationDefinition } from '../apps/types.ts'
import styles from './AppIcon.module.css'

const colors: Record<string, [string, string]> = {
  calendar: ['#ff6258', '#e63735'],
  music: ['#ff5776', '#dc2450'],
  browser: ['#42c7f5', '#087ad9'],
  terminal: ['#454a55', '#171b23'],
  files: ['#70d5ff', '#168ee5'],
  code: ['#738bff', '#4654ce'],
  system: ['#a7adb9', '#626a7a'],
}
export function AppIcon({ app, compact = false }: { app: ApplicationDefinition; compact?: boolean }) {
  const [top, bottom] = colors[app.id] ?? ['#749ac5', '#416a99']
  return (
    <span className={styles.icon} data-compact={compact} style={{ '--icon-top': top, '--icon-bottom': bottom } as CSSProperties}>
      <app.icon strokeWidth={1.65} aria-hidden="true" />
    </span>
  )
}

import type { LucideIcon } from 'lucide-react'
import type { CSSProperties } from 'react'
import styles from './AppIcon.module.css'

const tiles: Record<string, string> = {
  code: 'linear-gradient(160deg, #60b4ff, #0064dc)',
  files: 'linear-gradient(160deg, #75ceff, #218ee9)',
  music: 'linear-gradient(160deg, #ff6b8b, #ec254f)',
  browser: 'linear-gradient(160deg, #41ccf8, #0573e9)',
  terminal: 'linear-gradient(160deg, #55565e, #19191d)',
  system: 'linear-gradient(160deg, #a0a4ae, #5c6271)',
  devices: 'linear-gradient(160deg, #b48aff, #7546d9)',
}

export function AppIcon({ app, icon: Icon, className }: { app: string; icon: LucideIcon; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`${styles.icon} ${className ?? ''}`}
      style={{ '--app-tile': tiles[app] ?? 'linear-gradient(160deg, #5ac9a0, #148469)' } as CSSProperties}
    >
      <Icon strokeWidth={1.75} />
    </span>
  )
}

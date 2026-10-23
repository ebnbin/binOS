import type { ApplicationDefinition } from '../apps/types.ts'
import styles from './AppIcon.module.css'

// GNOME 风格的应用图标：按 app 取调色板颜色的圆角方块，上面是白色的符号图标。大小由外层决定
export function AppIcon({ app, className }: { app: ApplicationDefinition; className?: string }) {
  return (
    <span className={`${styles.icon} ${className ?? ''}`} data-app={app.id} aria-hidden="true">
      <app.icon size={64} />
    </span>
  )
}

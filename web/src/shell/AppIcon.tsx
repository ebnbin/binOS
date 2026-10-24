import type { ApplicationDefinition } from '../apps/types.ts'
import styles from './AppIcon.module.css'

// Apple 风格的 app 图标：超椭圆的纯色底，单色图形。大小跟随父元素的 font-size
export function AppIcon({ app, className }: { app: ApplicationDefinition; className?: string }) {
  return (
    <span className={`${styles.icon} ${className ?? ''}`} aria-hidden>
      <app.icon strokeWidth={1.75} />
    </span>
  )
}

import type { CSSProperties } from 'react'
import { findApplication, useApplications } from '../apps/index.ts'
import { AppIcon } from '../design/AppIcon.tsx'
import { desktopItems, itemSize } from './desktop-items.ts'
import { WidgetHost } from './hosts/WidgetHost.tsx'
import styles from './Desktop.module.css'

export function Desktop({ onOpen }: { onOpen: (app: string, route?: string) => void }) {
  const apps = useApplications()
  return (
    <main className={styles.desktop} aria-label="桌面">
      <div className={styles.grid}>
        {desktopItems(apps).map((item) => {
          const app = findApplication(apps, item.applicationId)
          if (!app) return null
          const { width, height } = itemSize(item)
          const style = { gridColumn: `span ${width}`, gridRow: `span ${height}` } as CSSProperties
          return item.kind === 'widget' ? (
            <WidgetHost key={item.id} item={item} application={app} style={style} onOpen={onOpen} />
          ) : (
            <button key={item.id} type="button" className={styles.icon} style={style} onClick={() => onOpen(app.id)}>
              <span className={styles.glyph}>
                <AppIcon app={app} />
              </span>
              <span className={styles.label}>{app.name}</span>
            </button>
          )
        })}
      </div>
    </main>
  )
}

import { Suspense } from 'react'
import type { CSSProperties } from 'react'
import { findApp, useApps } from '../apps/index.ts'
import type { AppManifest } from '../apps/types.ts'
import { useStateValue } from '../state.ts'
import { ErrorBoundary } from '../ui/ErrorBoundary.tsx'
import styles from './Desktop.module.css'
import { desktopKey, itemSize, readDesktop } from './desktop-items.ts'
import type { DesktopItem } from './desktop-items.ts'
import { column, desktopColumns, packColumn, splitColumns } from './layout.ts'

// 一栏 360 时的格子：两边 16，格子 70，间隔 16
const cell = 70
const gap = 16
const margin = (column.min - cell * 4 - gap * 3) / 2

export function Desktop({ width, onOpen }: { width: number; onOpen: (app: string, route?: string) => void }) {
  const apps = useApps()
  const items = readDesktop(useStateValue(desktopKey), apps)
  const { count, columnWidth, scale } = desktopColumns(width)
  const sizes = items.map(itemSize)
  const starts = splitColumns(sizes, count)
  const columns = starts.map((start, index) => {
    const end = starts[index + 1] ?? items.length
    return { items: items.slice(start, end), ...packColumn(sizes.slice(start, end)) }
  })

  const vars = {
    '--column': `${columnWidth}px`,
    '--count': count,
    '--cell': `${cell * scale}px`,
    '--gap': `${gap * scale}px`,
    '--margin': `${margin * scale}px`,
  } as CSSProperties

  return (
    <div className={styles.desktop} style={vars}>
      <div className={styles.columns}>
        {columns.map((column, index) => (
          <div key={index} className={styles.grid} style={{ gridTemplateRows: `repeat(${column.rows}, var(--cell))` }}>
            {column.items.map((item, itemIndex) => {
              const place = column.placements[itemIndex]
              return (
                <Item
                  key={itemIndex}
                  item={item}
                  apps={apps}
                  style={{ gridArea: `${place.row + 1} / ${place.column + 1} / span ${place.height} / span ${place.width}` }}
                  onOpen={onOpen}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function Item({
  item,
  apps,
  style,
  onOpen,
}: {
  item: DesktopItem
  apps: AppManifest[]
  style: CSSProperties
  onOpen: (app: string, route?: string) => void
}) {
  const app = findApp(apps, item.app)
  if (!app) {
    return null
  }
  if (!('widget' in item)) {
    return (
      <button type="button" className={styles.icon} style={style} onClick={() => onOpen(app.id)}>
        <span className={styles.glyph}>
          <app.icon strokeWidth={1.75} />
        </span>
        <span className={styles.label}>{app.name}</span>
      </button>
    )
  }
  const Widget = app.widgets?.[item.widget]?.component
  if (!Widget) {
    return null
  }
  return (
    // 点 widget 的空白处打开 app，widget 里的按钮自己处理点击
    <div className={styles.widget} style={style} onClick={() => onOpen(app.id)}>
      <ErrorBoundary fallback={() => <span className={styles.failed}>{app.name} 出错了</span>}>
        <Suspense>
          <Widget size={item.size} open={(route) => onOpen(app.id, route)} />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}

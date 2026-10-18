import { Suspense } from 'react'
import type { CSSProperties } from 'react'
import { findApp } from '../apps/index.ts'
import { useStateValue } from '../state.ts'
import { ErrorBoundary } from '../ui/ErrorBoundary.tsx'
import styles from './Desktop.module.css'
import { desktopKey, readDesktop } from './desktop-items.ts'
import type { DesktopItem } from './desktop-items.ts'
import { column, desktopColumns } from './layout.ts'

// 一栏 360 时的格子：两边 16，格子 70，间隔 16
const cell = 70
const gap = 16
const margin = (column.min - cell * 4 - gap * 3) / 2

export function Desktop({ width, onOpen }: { width: number; onOpen: (app: string, route?: string) => void }) {
  const groups = readDesktop(useStateValue(desktopKey))
  const { count, columnWidth, scale } = desktopColumns(width)
  // 每一组固定 4 格宽，依次分到屏幕上的各栏：栏少时同一栏里上下排几组，整个桌面只上下滚动
  const columns = Array.from({ length: count }, (_, index) => groups.filter((_, group) => group % count === index))

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
          <div key={index} className={styles.column}>
            {column.map((items, group) => (
              <div key={group} className={styles.grid}>
                {items.map((item, itemIndex) => (
                  <Item key={itemIndex} item={item} onOpen={onOpen} />
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function Item({ item, onOpen }: { item: DesktopItem; onOpen: (app: string, route?: string) => void }) {
  const app = findApp(item.app)
  if (!app) {
    return null
  }
  if (!('widget' in item)) {
    return (
      <button type="button" className={styles.icon} onClick={() => onOpen(app.id)}>
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
  const [w, h] = item.size.split('x')
  return (
    // 点 widget 的空白处打开 app，widget 里的按钮自己处理点击
    <div className={styles.widget} style={{ gridColumn: `span ${w}`, gridRow: `span ${h}` }} onClick={() => onOpen(app.id)}>
      <ErrorBoundary fallback={() => <span className={styles.failed}>{app.name} 出错了</span>}>
        <Suspense>
          <Widget size={item.size} open={(route) => onOpen(app.id, route)} />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}

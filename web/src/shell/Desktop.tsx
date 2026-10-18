import { Suspense, useLayoutEffect, useRef, useState } from 'react'
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
  const columns = readDesktop(useStateValue(desktopKey))
  const { count, columnWidth, scale } = desktopColumns(width)
  const [page, setPage] = useState(0)
  const pages = Math.max(1, columns.length - count + 1)
  const current = Math.min(page, pages - 1)
  const scroller = useRef<HTMLDivElement>(null)
  const lastWidth = useRef(columnWidth)

  // 一栏的宽度变了，停在原来那一栏的边上
  useLayoutEffect(() => {
    const element = scroller.current
    if (element) {
      element.scrollLeft = Math.round(element.scrollLeft / lastWidth.current) * columnWidth
    }
    lastWidth.current = columnWidth
  }, [columnWidth])

  const vars = {
    '--column': `${columnWidth}px`,
    '--count': count,
    '--cell': `${cell * scale}px`,
    '--gap': `${gap * scale}px`,
    '--margin': `${margin * scale}px`,
  } as CSSProperties

  return (
    <div className={styles.desktop} style={vars}>
      {/* 栏比屏幕放得下的多时，横向滑动，每次停在一栏的边上 */}
      <div
        className={styles.scroller}
        ref={scroller}
        onScroll={(event) => setPage(Math.round(event.currentTarget.scrollLeft / columnWidth))}
      >
        {columns.map((items, index) => (
          <section key={index} className={styles.column}>
            <div className={styles.grid}>
              {items.map((item, itemIndex) => (
                <Item key={itemIndex} item={item} onOpen={onOpen} />
              ))}
            </div>
          </section>
        ))}
      </div>
      {pages > 1 && (
        <nav className={styles.pages}>
          {Array.from({ length: pages }, (_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`第 ${index + 1} 页`}
              aria-current={index === current}
              onClick={() => scroller.current?.scrollTo({ left: index * columnWidth, behavior: 'smooth' })}
            />
          ))}
        </nav>
      )}
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

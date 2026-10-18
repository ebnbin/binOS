import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { findApp } from '../apps/index.ts'
import { BrandMark } from '../ui/BrandMark.tsx'
import type { BarPlacement } from './bar-placement.ts'
import { layouts } from './layout.ts'
import type { LayoutId } from './layout.ts'
import type { OpenWindow } from './Shell.tsx'
import styles from './TaskBar.module.css'

const layoutNames: Record<LayoutId, string> = {
  '1': '一个',
  '1:1': '平分',
  '1:2': '⅓ + ⅔',
  '2:1': '⅔ + ⅓',
  '1:1:1': '三等分',
}

function LayoutGlyph({ layout, portrait }: { layout: LayoutId; portrait: boolean }) {
  return (
    <span className={styles.glyph} data-portrait={portrait}>
      {layouts[layout].map((part, index) => (
        <i key={index} style={{ flex: part }} />
      ))}
    </span>
  )
}

// 屏幕外面的控制栏：回到桌面、开着的 app、分屏布局、关闭当前窗口
export function TaskBar({
  placement,
  windows,
  panes,
  focused,
  home,
  layout,
  allowed,
  portrait,
  onHome,
  onShow,
  onLayout,
  onClose,
}: {
  placement: Exclude<BarPlacement, 'hidden'>
  windows: OpenWindow[]
  panes: (string | null)[]
  focused: string | null
  home: boolean
  layout: LayoutId
  allowed: LayoutId[]
  portrait: boolean
  onHome: () => void
  onShow: (id: string) => void
  onLayout: (layout: LayoutId) => void
  onClose: () => void
}) {
  const [picking, setPicking] = useState(false)
  const picker = useRef<HTMLDivElement>(null)
  const canPick = !home && allowed.length > 1

  // 点到面板外面时收起
  useEffect(() => {
    if (!picking) {
      return
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!picker.current?.contains(event.target as Node)) {
        setPicking(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [picking])

  return (
    <nav className={styles.bar} data-placement={placement}>
      <div className={styles.dock}>
        <button type="button" className={styles.item} aria-label="桌面" title="桌面" aria-pressed={home} onClick={onHome}>
          <BrandMark size={22} inverted />
        </button>
        {windows.length > 0 && <span className={styles.separator} />}
        {windows.map((item) => {
          const app = findApp(item.window.app)
          return (
            <button
              key={item.id}
              type="button"
              className={styles.item}
              aria-label={item.title}
              title={item.title}
              aria-pressed={!home && item.id === focused}
              data-visible={!home && panes.includes(item.id)}
              onClick={() => onShow(item.id)}
            >
              {app && <app.icon size={21} strokeWidth={1.75} />}
            </button>
          )
        })}
        {canPick && (
          <>
            <span className={styles.separator} />
            <div ref={picker} className={styles.picker}>
              <button
                type="button"
                className={styles.item}
                aria-label="分屏"
                title="分屏"
                aria-expanded={picking}
                aria-pressed={picking}
                onClick={() => setPicking(!picking)}
              >
                <LayoutGlyph layout={layout} portrait={portrait} />
              </button>
              {picking && (
                <div className={styles.popover}>
                  {allowed.map((id) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={id === layout}
                      onClick={() => {
                        setPicking(false)
                        onLayout(id)
                      }}
                    >
                      <LayoutGlyph layout={id} portrait={portrait} />
                      {layoutNames[id]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
        {!home && focused && (
          <>
            <span className={styles.separator} />
            <button type="button" className={styles.item} aria-label="关闭当前窗口" title="关闭当前窗口" onClick={onClose}>
              <X size={21} strokeWidth={1.75} />
            </button>
          </>
        )}
      </div>
    </nav>
  )
}

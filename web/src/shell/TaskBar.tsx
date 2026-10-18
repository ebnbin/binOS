import { X } from 'lucide-react'
import { findApp } from '../apps/index.ts'
import { BrandMark } from '../ui/BrandMark.tsx'
import type { OpenWindow } from './Shell.tsx'
import { layouts } from './layout.ts'
import type { LayoutId } from './layout.ts'
import styles from './TaskBar.module.css'

const layoutNames: Record<LayoutId, string> = {
  '1': '一个窗口',
  '1:1': '两个窗口平分',
  '1:2': '⅓ + ⅔',
  '2:1': '⅔ + ⅓',
  '1:1:1': '三个窗口平分',
}

// 底部的任务栏：回到桌面、开着的 app、这台设备放得下的分屏布局、关闭当前窗口
export function TaskBar({
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
  return (
    <nav className={styles.bar}>
      <div className={styles.dock}>
        <button type="button" className={styles.item} aria-label="桌面" title="桌面" aria-pressed={home} onClick={onHome}>
          <BrandMark size={22} />
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
              {app && <app.icon size={20} strokeWidth={1.75} />}
            </button>
          )
        })}
        {!home && allowed.length > 1 && (
          <>
            <span className={styles.separator} />
            {allowed.map((id) => (
              <button
                key={id}
                type="button"
                className={styles.item}
                aria-label={layoutNames[id]}
                title={layoutNames[id]}
                aria-pressed={id === layout}
                onClick={() => onLayout(id)}
              >
                <span className={styles.glyph} data-portrait={portrait}>
                  {layouts[id].map((part, index) => (
                    <i key={index} style={{ flex: part }} />
                  ))}
                </span>
              </button>
            ))}
          </>
        )}
        {!home && focused && (
          <>
            <span className={styles.separator} />
            <button type="button" className={styles.item} aria-label="关闭当前窗口" title="关闭当前窗口" onClick={onClose}>
              <X size={20} strokeWidth={1.75} />
            </button>
          </>
        )}
      </div>
    </nav>
  )
}

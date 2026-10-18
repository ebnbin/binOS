import { apps } from '../apps/index.ts'
import { AppHost } from './AppHost.tsx'
import type { OpenWindow } from './Shell.tsx'
import { layouts } from './layout.ts'
import type { LayoutId } from './layout.ts'
import styles from './Workspace.module.css'

// 按分屏布局排列窗口。所有开着的窗口都留在页面里，没显示的隐藏起来，切回来时滚动位置和输入框都还在
export function Workspace({
  windows,
  panes,
  layout,
  portrait,
  hidden,
  onFocus,
  onPick,
  onTitle,
}: {
  windows: OpenWindow[]
  panes: (string | null)[]
  layout: LayoutId
  portrait: boolean
  hidden: boolean
  onFocus: (id: string | null, slot: number) => void
  onPick: (app: string, slot: number) => void
  onTitle: (id: string, title: string) => void
}) {
  const tracks = layouts[layout].map((part) => `minmax(0, ${part}fr)`).join(' ')
  // 行和列都要指定，只指定一个时，前面的位置空着会被自动排到下一行
  const position = (slot: number) => ({ gridArea: portrait ? `${slot + 1} / 1` : `1 / ${slot + 1}` })

  return (
    <div
      className={styles.workspace}
      hidden={hidden}
      data-portrait={portrait}
      style={portrait ? { gridTemplateRows: tracks } : { gridTemplateColumns: tracks }}
    >
      {windows.map((item) => {
        const slot = panes.indexOf(item.id)
        return (
          <section
            key={item.id}
            className={styles.pane}
            hidden={slot < 0}
            data-first={slot === 0}
            style={position(slot)}
            aria-label={item.title}
            onPointerDownCapture={() => onFocus(item.id, slot)}
          >
            <AppHost id={item.id} window={item.window} onTitle={onTitle} />
          </section>
        )
      })}
      {panes.map(
        (id, slot) =>
          id === null && (
            <section
              key={`empty-${slot}`}
              className={styles.pane}
              data-first={slot === 0}
                style={position(slot)}
              onPointerDownCapture={() => onFocus(null, slot)}
            >
              <div className={styles.picker}>
                <p>在这里打开</p>
                <div className={styles.choices}>
                  {apps.map((app) => (
                    <button key={app.id} type="button" onClick={() => onPick(app.id, slot)}>
                      <app.icon size={18} strokeWidth={1.75} />
                      {app.name}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          ),
      )}
    </div>
  )
}

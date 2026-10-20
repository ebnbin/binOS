import { ExternalLink, X } from 'lucide-react'
import { findApp, useApps } from '../apps/index.ts'
import { BrandMark } from '../ui/BrandMark.tsx'
import type { BarPlacement } from './bar-placement.ts'
import { layouts } from './layout.ts'
import type { LayoutId, SplitGroup } from './layout.ts'
import type { OpenWindow } from './Shell.tsx'
import styles from './TaskBar.module.css'

// active：聚焦的位置，亮起来的那一块
function LayoutGlyph({ layout, portrait, active }: { layout: LayoutId; portrait: boolean; active?: number }) {
  return (
    <span className={styles.glyph} data-portrait={portrait}>
      {layouts[layout].map((part, index) => (
        <i key={index} style={{ flex: part }} data-active={active === undefined ? undefined : index === active} />
      ))}
    </span>
  )
}

// 屏幕外面的控制栏：回到桌面、开着的 app、分屏布局、在新标签页打开外部 app、关闭当前窗口。分屏时，布局按钮上亮起的一块是聚焦的窗口
export function TaskBar({
  placement,
  windows,
  groups,
  locked,
  panes,
  focused,
  focusedSlot,
  home,
  layout,
  allowed,
  portrait,
  onHome,
  onShow,
  onSplit,
  onClose,
}: {
  placement: Exclude<BarPlacement, 'hidden'>
  windows: OpenWindow[]
  groups: SplitGroup[]
  locked: boolean
  panes: (string | null)[]
  focused: string | null
  focusedSlot: number
  home: boolean
  layout: LayoutId
  allowed: LayoutId[]
  portrait: boolean
  onHome: () => void
  onShow: (id: string) => void
  onSplit: () => void
  onClose: () => void
}) {
  const apps = useApps()
  // 外部 app 的窗口可以在新标签页打开，比如要在那里重新登录
  const focusedUrl = findApp(apps, windows.find((item) => item.id === focused)?.window.app ?? '')?.url
  const canPick = !home && !locked && allowed.length > 1

  return (
    <nav inert={locked} className={styles.bar} data-placement={placement}>
      <div className={styles.dock}>
        <button type="button" className={styles.item} aria-label="桌面" title="桌面" aria-pressed={home} onClick={onHome}>
          <BrandMark size={22} inverted />
        </button>
        {windows.length > 0 && <span className={styles.separator} />}
        <div className={styles.apps}>
          {windows.filter((item) => {
            const group = groups.find((group) => group.slots.includes(item.id))
            return !group || group.slots[0] === item.id
          }).map((item) => {
            const group = groups.find((group) => group.slots.includes(item.id))
            const members = group ? group.slots.map((id) => windows.find((win) => win.id === id)!).filter(Boolean) : [item]
            const title = members.map((member) => member.title).join(' + ')
            return (
              <button
                key={group?.id ?? item.id}
                type="button"
                className={styles.item}
                data-group={!!group}
                aria-label={title}
                title={title}
                aria-pressed={!home && members.some((member) => member.id === focused)}
                data-visible={!home && members.some((member) => panes.includes(member.id))}
                onClick={() => onShow(members.find((member) => member.id === focused)?.id ?? item.id)}
              >
                {members.map((member) => {
                  const app = findApp(apps, member.window.app)
                  return app && <app.icon key={member.id} size={group ? 18 : 21} strokeWidth={1.75} />
                })}
              </button>
            )
          })}
        </div>
        {!home && focused && (
          <>
            <span className={styles.separator} />
            {canPick && (
              <button type="button" className={styles.item} aria-label="分屏" title="分屏" onClick={onSplit}>
                <LayoutGlyph layout={layout === '1' ? '1:1' : layout} portrait={portrait} active={layout === '1' ? undefined : focusedSlot} />
              </button>
            )}
            {focusedUrl && (
              <button
                type="button"
                className={styles.item}
                aria-label="在新标签页打开"
                title="在新标签页打开"
                onClick={() => window.open(focusedUrl, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink size={21} strokeWidth={1.75} />
              </button>
            )}
            <button type="button" className={styles.item} aria-label="关闭当前窗口" title="关闭当前窗口" onClick={onClose}>
              <X size={21} strokeWidth={1.75} />
            </button>
          </>
        )}
      </div>
    </nav>
  )
}

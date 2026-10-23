import type { ReactElement, ReactNode } from 'react'
import { findApplication, useApplications } from '../apps/index.ts'
import { BrandMark } from '../ui/BrandMark.tsx'
import { Close, OpenInNew } from '../ui/icons.tsx'
import { Ripple } from '../ui/Ripple.tsx'
import { Tooltip } from '../ui/Tooltip.tsx'
import type { BarPlacement } from './bar-placement.ts'
import { layouts } from './layout.ts'
import type { LayoutId, SplitGroup } from './layout.ts'
import type { OpenWindow } from './state/types.ts'
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

// 屏幕外面的控制栏，M3 的导航栏（在下面）或导航轨（在侧边）：回到桌面、开着的 app、分屏布局、在新标签页打开外部 app、关闭当前窗口。分屏时，布局按钮上亮起的一块是聚焦的窗口
export function TaskBar({
  placement,
  accessory,
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
  accessory?: ReactNode
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
  const apps = useApplications()
  // 外部 app 的窗口可以在新标签页打开，比如要在那里重新登录
  const focusedUrl = findApplication(apps, windows.find((item) => item.id === focused)?.window.applicationId ?? '')?.url
  const canPick = !home && !locked && !groups.some((group) => focused && group.slots.includes(focused)) && allowed.length > 1
  const side = placement === 'bottom' ? 'top' : placement === 'left' ? 'right' : 'left'
  const tip = (label: string, button: ReactElement, key?: string) => <Tooltip key={key} label={label} side={side}>{button}</Tooltip>

  return (
    <nav inert={locked} className={styles.bar} data-placement={placement}>
      <div className={styles.dock}>
        {tip('桌面', (
          <button type="button" className={styles.item} aria-label="桌面" aria-pressed={home} onClick={onHome}>
            <Ripple />
            <BrandMark size={24} />
          </button>
        ))}
        {accessory}
        {windows.length > 0 && <span className={styles.separator} />}
        <div className={styles.apps}>
          {windows.filter((item) => {
            const group = groups.find((group) => group.slots.includes(item.id))
            return !group || group.slots[0] === item.id
          }).map((item) => {
            const group = groups.find((group) => group.slots.includes(item.id))
            const members = group ? group.slots.map((id) => windows.find((win) => win.id === id)!).filter(Boolean) : [item]
            const title = members.map((member) => member.title).join(' + ')
            const pressed = !home && members.some((member) => member.id === focused)
            return tip(title, (
              <button
                type="button"
                className={styles.item}
                data-group={!!group}
                aria-label={title}
                aria-pressed={pressed}
                data-visible={!home && members.some((member) => panes.includes(member.id))}
                onClick={() => onShow(members.find((member) => member.id === focused)?.id ?? item.id)}
              >
                <Ripple />
                {members.map((member) => {
                  const app = findApplication(apps, member.window.applicationId)
                  return app && (
                    <span key={member.id} className={styles.member} data-focused={!!group && !home && member.id === focused}>
                      <app.icon size={group ? 20 : 24} filled={group ? !home && member.id === focused : pressed} />
                    </span>
                  )
                })}
              </button>
            ), group?.id ?? item.id)
          })}
        </div>
        {!home && focused && (
          <>
            <span className={styles.separator} />
            {canPick && tip('分屏', (
              <button type="button" className={styles.item} aria-label="分屏" onClick={onSplit}>
                <Ripple />
                <LayoutGlyph layout={layout === '1' ? '1:1' : layout} portrait={portrait} active={layout === '1' ? undefined : focusedSlot} />
              </button>
            ))}
            {focusedUrl && tip('在新标签页打开', (
              <button type="button" className={styles.item} aria-label="在新标签页打开" onClick={() => window.open(focusedUrl, '_blank', 'noopener,noreferrer')}>
                <Ripple />
                <OpenInNew />
              </button>
            ))}
            {tip('关闭当前窗口', (
              <button type="button" className={styles.item} aria-label="关闭当前窗口" onClick={onClose}>
                <Ripple />
                <Close />
              </button>
            ))}
          </>
        )}
      </div>
    </nav>
  )
}

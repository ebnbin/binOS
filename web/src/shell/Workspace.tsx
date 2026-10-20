import { useRef, useState } from 'react'
import { AppHost } from './AppHost.tsx'
import type { OpenWindow } from './Shell.tsx'
import { allowedLayouts, minPane, paneGap, paneSizes, snapLayout } from './layout.ts'
import type { LayoutId, Size } from './layout.ts'
import styles from './Workspace.module.css'

// 按分屏布局排列窗口。所有开着的窗口都留在页面里，没显示的隐藏起来，切回来时滚动位置和输入框都还在
export function Workspace({
  windows,
  panes,
  layout,
  hidden,
  onFocus,
  onLayout,
  onExit,
  size,
  portrait,
  onTitle,
}: {
  windows: OpenWindow[]
  panes: (string | null)[]
  layout: LayoutId
  hidden: boolean
  onFocus: (id: string | null, slot: number) => void
  onLayout: (layout: LayoutId) => void
  onExit: (keep: number) => void
  size: Size
  portrait: boolean
  onTitle: (id: string, title: string) => void
}) {
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{ pointer: number; start: number; length: number } | null>(null)
  const sizes = paneSizes(layout, size)
  const first = portrait ? sizes[0].height : sizes[0].width
  const minimum = portrait ? minPane.height : minPane.width
  const length = portrait ? size.height : size.width
  const position = (slot: number) => portrait
    ? { top: slot === 0 ? 0 : first + paneGap, height: sizes[slot]?.height ?? 0, left: 0, width: size.width }
    : { left: slot === 0 ? 0 : first + paneGap, width: sizes[slot]?.width ?? 0, top: 0, height: size.height }
  const stop = () => {
    drag.current = null
    setDragging(false)
  }

  return (
    <div
      className={styles.workspace}
      hidden={hidden}
      data-dragging={dragging}
      data-portrait={portrait}
    >
      {windows.map((item) => {
        const slot = panes.indexOf(item.id)
        return (
          <section
            key={item.id}
            className={styles.pane}
            hidden={slot < 0}
            style={position(slot)}
            aria-label={item.title}
            onPointerDownCapture={() => onFocus(item.id, slot)}
          >
            <AppHost id={item.id} window={item.window} onTitle={onTitle} />
          </section>
        )
      })}
      {layout !== '1' && (
        <div
          className={styles.divider}
          style={portrait ? { top: first - 5, height: paneGap + 10 } : { left: first - 5, width: paneGap + 10 }}
          role="separator"
          aria-label="调整分屏，拖到边缘取消"
          aria-orientation={portrait ? 'horizontal' : 'vertical'}
          aria-valuemin={minimum}
          aria-valuemax={length - paneGap - minimum}
          aria-valuenow={first}
          tabIndex={0}
          onKeyDown={(event) => {
            const backward = portrait ? 'ArrowUp' : 'ArrowLeft'
            const forward = portrait ? 'ArrowDown' : 'ArrowRight'
            if (event.key === backward || event.key === forward) {
              event.preventDefault()
              const choices = (['1:2', '1:1', '2:1'] as LayoutId[]).filter((id) => allowedLayouts(size).includes(id))
              const index = choices.indexOf(layout)
              onLayout(choices[Math.max(0, Math.min(choices.length - 1, index + (event.key === backward ? -1 : 1)))])
            }
          }}
          onPointerDown={(event) => {
            event.preventDefault()
            event.currentTarget.setPointerCapture(event.pointerId)
            const bounds = event.currentTarget.parentElement!.getBoundingClientRect()
            drag.current = { pointer: event.pointerId, start: portrait ? bounds.top : bounds.left, length: portrait ? bounds.height : bounds.width }
            setDragging(true)
          }}
          onPointerMove={(event) => {
            const current = drag.current
            if (!current || current.pointer !== event.pointerId) return
            const x = (portrait ? event.clientY : event.clientX) - current.start
            if (x < minimum / 2 || x > current.length - minimum / 2) {
              stop()
              onExit(x < minimum / 2 ? 1 : 0)
            } else {
              onLayout(snapLayout(x, current.length, minimum))
            }
          }}
          onPointerUp={stop}
          onPointerCancel={stop}
          onLostPointerCapture={stop}
        />
      )}
    </div>
  )
}

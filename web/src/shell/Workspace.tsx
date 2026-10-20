import { useRef, useState } from 'react'
import { useApps } from '../apps/index.ts'
import { AppHost } from './AppHost.tsx'
import type { OpenWindow } from './Shell.tsx'
import { allowedLayouts, minPane, paneGap, paneSizes, snapLayout } from './layout.ts'
import type { LayoutId, Size } from './layout.ts'
import styles from './Workspace.module.css'

type Drag = { pointer: number; start: number; length: number; position: number; origin: number }

// 所有窗口保留挂载，退出布局后滚动位置和输入仍然保留。
export function Workspace({
  windows, panes, layout, hidden, onFocus, onLayout, onExit, onPick, onSwap, onCancel, size, portrait, onTitle, placing, onPlace, onDismissPlacement,
}: {
  placing: string | null
  onPlace: (slot: number) => void
  onDismissPlacement: () => void
  windows: OpenWindow[]
  panes: (string | null)[]
  layout: LayoutId
  hidden: boolean
  onFocus: (id: string | null, slot: number) => void
  onLayout: (layout: LayoutId) => void
  onExit: (keep: number) => void
  onPick: (app: string, slot: number) => void
  onSwap: () => void
  onCancel: () => void
  size: Size
  portrait: boolean
  onTitle: (id: string, title: string) => void
}) {
  const apps = useApps()
  const [offset, setOffset] = useState<number | null>(null)
  const drag = useRef<Drag | null>(null)
  const sizes = paneSizes(layout, size)
  const first = offset ?? (portrait ? sizes[0].height : sizes[0].width)
  const length = portrait ? size.height : size.width
  const exiting = offset === null ? null : offset + paneGap / 2 < minPane / 2 ? 0 : offset + paneGap / 2 > length - minPane / 2 ? 1 : null
  const position = (slot: number) => {
    const start = slot === 0 ? 0 : first + paneGap
    const extent = layout === '1' ? length : slot === 0 ? first : length - first - paneGap
    return portrait ? { top: start, height: extent, left: 0, width: size.width } : { left: start, width: extent, top: 0, height: size.height }
  }
  const stop = () => {
    drag.current = null
    setOffset(null)
  }
  const preview = (slot: number) => exiting === slot && <div className={styles.exitPreview} />

  return (
    <div className={styles.workspace} hidden={hidden} data-dragging={offset !== null} data-portrait={portrait}>
      {windows.map((item) => {
        const slot = panes.indexOf(item.id)
        return (
          <section key={item.id} className={styles.pane} hidden={slot < 0} style={position(slot)}
            data-exiting={exiting === slot} aria-label={item.title} onPointerDownCapture={() => onFocus(item.id, slot)}>
            <div className={styles.content}><AppHost id={item.id} window={item.window} onTitle={onTitle} /></div>
            {preview(slot)}
          </section>
        )
      })}
      {layout !== '1' && panes.map((id, slot) => id === null && (
        <section key={slot} className={styles.pane} style={position(slot)} data-exiting={exiting === slot} aria-label="选择第二个 app">
          <div className={styles.picker}>
            <p>选择第二个 app</p>
            <div className={styles.choices}>
              {apps.filter((app) => !windows.some((item) => item.window.app === app.id && panes.includes(item.id))).map((app) => (
                <button key={app.id} type="button" onClick={() => onPick(app.id, slot)}><app.icon size={20} />{app.name}</button>
              ))}
            </div>
            <button type="button" onClick={onCancel}>取消分屏</button>
          </div>
          {preview(slot)}
        </section>
      ))}
      {placing && (
        <>
          <div className={styles.placementBar}>
            <span role="status">将 {placing} 放在哪边？</span>
            <button type="button" onClick={onDismissPlacement}>取消</button>
          </div>
          {panes.map((_, slot) => (
            <div key={slot} className={styles.placementTarget} style={position(slot)}>
              <button type="button" onClick={() => onPlace(slot)}>
                {portrait ? (slot === 0 ? '放在上侧' : '放在下侧') : (slot === 0 ? '放在左侧' : '放在右侧')}
              </button>
            </div>
          ))}
        </>
      )}
      {exiting !== null && (
        <div className={styles.exitHint} role="status">{panes[exiting] ? '松手退到后台' : '松手取消分屏'}</div>
      )}
      {layout !== '1' && (
        <div className={styles.divider}
          style={portrait ? { top: first - 5, height: paneGap + 10 } : { left: first - 5, width: paneGap + 10 }}
          role="separator" aria-label="调整分屏，双击交换位置" aria-orientation={portrait ? 'horizontal' : 'vertical'}
          aria-valuemin={0} aria-valuemax={length - paneGap} aria-valuenow={Math.round(first)} tabIndex={0}
          onDoubleClick={onSwap}
          onKeyDown={(event) => {
            if (event.key === 'Escape') { stop(); return }
            if (event.key === 'Enter') { onSwap(); return }
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
            if (event.button !== 0) return
            event.preventDefault()
            event.currentTarget.focus()
            event.currentTarget.setPointerCapture(event.pointerId)
            const bounds = event.currentTarget.parentElement!.getBoundingClientRect()
            const start = portrait ? bounds.top : bounds.left
            const pointer = portrait ? event.clientY : event.clientX
            drag.current = { pointer: event.pointerId, start, length, position: first + paneGap / 2, origin: pointer - start - first - paneGap / 2 }
            setOffset(first)
          }}
          onPointerMove={(event) => {
            const current = drag.current
            if (!current || current.pointer !== event.pointerId) return
            current.position = Math.max(paneGap / 2, Math.min(current.length - paneGap / 2, (portrait ? event.clientY : event.clientX) - current.start - current.origin))
            setOffset(current.position - paneGap / 2)
          }}
          onPointerUp={(event) => {
            const current = drag.current
            if (!current || current.pointer !== event.pointerId) return
            if (current.position < minPane / 2 || current.position > current.length - minPane / 2) {
              onExit(current.position < minPane / 2 ? 1 : 0)
            } else {
              onLayout(snapLayout(current.position, current.length))
            }
            stop()
          }}
          onPointerCancel={stop} onLostPointerCapture={stop}
        ><span className={styles.handle} /></div>
      )}
    </div>
  )
}

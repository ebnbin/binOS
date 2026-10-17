import { useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { AppHost } from './AppHost.tsx'
import { clampFrame } from './layout.ts'
import type { Area, Frame } from './layout.ts'
import type { OpenWindow } from './Shell.tsx'
import styles from './Window.module.css'
import { closeWindow, focusWindow, minimizeWindow, setFrame } from './windows.ts'

// 拖动标题栏移动，拖右下角缩放。拖动过程只在本地，松手时才写进系统状态
export function AppWindow({
  item,
  frame,
  stored,
  area,
  z,
  focused,
  onTitle,
}: {
  item: OpenWindow
  // frame 是显示的位置（最大化或拉回屏幕内之后的），stored 是存着的
  frame: Frame
  stored: Frame
  area: Area
  z: number
  focused: boolean
  onTitle: (id: string, title: string) => void
}) {
  const [dragging, setDragging] = useState<Frame | null>(null)
  const start = useRef<{ x: number; y: number; frame: Frame; mode: 'move' | 'resize' } | null>(null)
  const shown = dragging ?? frame

  function begin(event: PointerEvent<HTMLElement>, mode: 'move' | 'resize') {
    if (event.button !== 0 || frame.maximized) {
      return
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    start.current = { x: event.clientX, y: event.clientY, frame, mode }
  }

  function move(event: PointerEvent<HTMLElement>) {
    const from = start.current
    if (!from) {
      return
    }
    const dx = event.clientX - from.x
    const dy = event.clientY - from.y
    setDragging(
      from.mode === 'move'
        ? { ...from.frame, x: from.frame.x + dx, y: from.frame.y + dy }
        : { ...from.frame, w: from.frame.w + dx, h: from.frame.h + dy },
    )
  }

  function end() {
    if (dragging) {
      setFrame(item.id, clampFrame({ ...dragging, minimized: false, maximized: false }, area))
    }
    start.current = null
    setDragging(null)
  }

  const toggleMaximized = () => setFrame(item.id, { ...stored, maximized: !stored.maximized })

  return (
    <section
      className={styles.window}
      data-focused={focused}
      data-maximized={frame.maximized}
      hidden={stored.minimized}
      style={{ left: shown.x, top: shown.y, width: shown.w, height: shown.h, zIndex: z }}
      onPointerDownCapture={() => focused || focusWindow(item.id, 'desktop')}
      aria-label={item.title}
    >
      <header
        className={styles.titleBar}
        onPointerDown={(event) => begin(event, 'move')}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onDoubleClick={toggleMaximized}
      >
        <div className={styles.lights} onPointerDown={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
          <button type="button" className={styles.close} aria-label="关闭" title="关闭" onClick={() => closeWindow(item.id)} />
          <button type="button" className={styles.minimize} aria-label="最小化" title="最小化" onClick={() => minimizeWindow(item.id, 'desktop')} />
          <button
            type="button"
            className={styles.maximize}
            aria-label={frame.maximized ? '还原' : '最大化'}
            title={frame.maximized ? '还原' : '最大化'}
            onClick={toggleMaximized}
          />
        </div>
        <span className={styles.title}>{item.title}</span>
      </header>
      <div className={styles.content}>
        <AppHost id={item.id} window={item.window} onTitle={onTitle} />
      </div>
      {!frame.maximized && (
        <div className={styles.resize} onPointerDown={(event) => begin(event, 'resize')} onPointerMove={move} onPointerUp={end} onPointerCancel={end} />
      )}
    </section>
  )
}

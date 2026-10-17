import { useEffect, useState } from 'react'
import { apps, findApp } from '../apps/index.ts'
import { useConnected } from '../events.ts'
import { useStateList } from '../state.ts'
import { BrandMark } from '../ui/BrandMark.tsx'
import styles from './Desktop.module.css'
import { clampFrame, placeFrame } from './layout.ts'
import type { Area, Focus, Frame } from './layout.ts'
import type { OpenWindow } from './Shell.tsx'
import { AppWindow } from './Window.tsx'
import { focusWindow, framePrefix, openApp } from './windows.ts'

const menuBarHeight = 28
// 最大化时留出 Dock 的位置
const dockSpace = 84

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 10_000)
    return () => window.clearInterval(timer)
  }, [])
  return now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

export function Desktop({
  windows,
  focus,
  size,
  onTitle,
}: {
  windows: OpenWindow[]
  focus: Focus
  size: { width: number; height: number }
  onTitle: (id: string, title: string) => void
}) {
  const frames = new Map(useStateList(framePrefix).map(([key, value]) => [key.slice(framePrefix.length), value as Frame]))
  const connected = useConnected()
  const clock = useClock()
  const area: Area = { top: menuBarHeight, width: size.width, height: size.height - menuBarHeight }
  const maximizedFrame: Frame = { x: 0, y: menuBarHeight, w: size.width, h: size.height - menuBarHeight - dockSpace, minimized: false, maximized: true }
  const focused = windows.find((item) => item.id === focus.focused)
  const focusedApp = focused && findApp(focused.window.app)

  return (
    <div className={styles.desktop}>
      <header className={styles.menuBar}>
        <BrandMark size={16} />
        <span className={styles.wordmark}>binOS</span>
        <span className={styles.current}>{focusedApp?.name ?? '桌面'}</span>
        <span className={styles.spacer} />
        <span className={styles.connection} data-connected={connected} title={connected ? '已连接' : '连接已断开'} />
        <span className={styles.clock}>{clock}</span>
      </header>
      {/* 点到空白处时取消聚焦 */}
      <div className={styles.wallpaper} onPointerDown={() => focus.focused && focusWindow(null, 'desktop')} />
      {focus.stack.map((id, index) => {
        const item = windows.find((win) => win.id === id)
        if (!item) {
          return null
        }
        const stored = frames.get(id) ?? placeFrame(findApp(item.window.app)?.defaultSize ?? { width: 640, height: 480 }, area, index)
        const frame = stored.maximized ? maximizedFrame : clampFrame(stored, area)
        return (
          <AppWindow
            key={id}
            item={item}
            frame={frame}
            stored={stored}
            area={area}
            z={index + 1}
            focused={focus.focused === id}
            onTitle={onTitle}
          />
        )
      })}
      <nav className={styles.dock}>
        {apps.map((app) => {
          const running = windows.some((item) => item.window.app === app.id)
          return (
            <button
              key={app.id}
              type="button"
              className={styles.dockItem}
              title={app.name}
              aria-label={app.name}
              data-running={running}
              onClick={() => openApp(app.id, 'desktop', area)}
            >
              <app.icon size={24} strokeWidth={1.75} />
            </button>
          )
        })}
      </nav>
    </div>
  )
}

import { X } from 'lucide-react'
import { useRef, useState } from 'react'
import { apps, findApp } from '../apps/index.ts'
import { BrandMark } from '../ui/BrandMark.tsx'
import { AppHost } from './AppHost.tsx'
import type { Focus } from './layout.ts'
import styles from './Mobile.module.css'
import type { OpenWindow } from './Shell.tsx'
import { closeWindow, focusWindow, openApp } from './windows.ts'

const longPress = 450

// 一次只显示一个 app，占满屏幕。没在显示的 app 留在页面里，切回来时滚动位置和输入框都还在
export function Mobile({ windows, focus, onTitle }: { windows: OpenWindow[]; focus: Focus; onTitle: (id: string, title: string) => void }) {
  const [switcher, setSwitcher] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const pressed = useRef(false)
  const home = focus.focused === null
  // 切换器里最近用过的在前
  const recent = [...focus.stack].reverse().flatMap((id) => windows.filter((item) => item.id === id))

  function pressStart() {
    pressed.current = true
    timer.current = window.setTimeout(() => {
      pressed.current = false
      setSwitcher(true)
    }, longPress)
  }

  function pressEnd() {
    window.clearTimeout(timer.current)
    if (pressed.current) {
      pressed.current = false
      setSwitcher(false)
      focusWindow(null, 'mobile')
    }
  }

  return (
    <div className={styles.mobile}>
      <div className={styles.home} hidden={!home}>
        <header className={styles.brand}>
          <BrandMark size={30} />
          <span className={styles.wordmark}>binOS</span>
        </header>
        <div className={styles.grid}>
          {apps.map((app) => (
            <button key={app.id} type="button" className={styles.app} onClick={() => openApp(app.id, 'mobile')}>
              <span className={styles.icon}>
                <app.icon size={28} strokeWidth={1.75} />
              </span>
              {app.name}
            </button>
          ))}
        </div>
      </div>
      {windows.map((item) => (
        <div key={item.id} className={styles.screen} hidden={item.id !== focus.focused}>
          <AppHost id={item.id} window={item.window} onTitle={onTitle} />
        </div>
      ))}
      {switcher && (
        <div className={styles.switcher} onClick={() => setSwitcher(false)}>
          {recent.length === 0 && <p className={styles.empty}>没有打开的 app</p>}
          {recent.map((item) => {
            const app = findApp(item.window.app)
            return (
              <div key={item.id} className={styles.card}>
                <button
                  type="button"
                  className={styles.cardBody}
                  onClick={() => {
                    setSwitcher(false)
                    focusWindow(item.id, 'mobile')
                  }}
                >
                  <span className={styles.icon}>{app && <app.icon size={28} strokeWidth={1.75} />}</span>
                  <span className={styles.cardTitle}>{item.title}</span>
                </button>
                <button
                  type="button"
                  className={styles.cardClose}
                  aria-label="关闭"
                  onClick={(event) => {
                    event.stopPropagation()
                    closeWindow(item.id)
                  }}
                >
                  <X size={16} strokeWidth={2} />
                </button>
              </div>
            )
          })}
        </div>
      )}
      {/* 点一下回到主屏，长按打开切换器 */}
      <button
        type="button"
        className={styles.homeBar}
        aria-label="回到主屏，长按切换 app"
        onPointerDown={pressStart}
        onPointerUp={pressEnd}
        onPointerCancel={() => window.clearTimeout(timer.current)}
        onContextMenu={(event) => event.preventDefault()}
      >
        <span />
      </button>
    </div>
  )
}

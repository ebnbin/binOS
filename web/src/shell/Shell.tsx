import { useCallback, useEffect, useState } from 'react'
import { findApp, useApps, useAppsLoaded } from '../apps/index.ts'
import type { AppManifest } from '../apps/types.ts'
import { useElementSize } from '../ui/useElementSize.ts'
import { useBarPlacement } from './bar-placement.ts'
import { ConnectionStatus } from './ConnectionStatus.tsx'
import { Desktop } from './Desktop.tsx'
import { restoreRoute } from './history.ts'
import type { HistoryState } from './history.ts'
import styles from './Shell.module.css'
import { allowedLayouts, arrange, fitLayout, isPortrait, layouts, place } from './layout.ts'
import type { LayoutId } from './layout.ts'
import { SplitPicker } from './SplitPicker.tsx'
import { TaskBar } from './TaskBar.tsx'
import { Workspace } from './Workspace.tsx'
import { closeWindow, ensureWindow, saveWorkspace, setRoute, updateWorkspace, useWindows } from './windows.ts'
import type { WindowState } from './windows.ts'

export type OpenWindow = { id: string; window: WindowState; title: string }

// 这台设备自己的界面状态（窗口和分屏布局见 windows.ts）：显示桌面还是窗口、聚焦的窗口和分屏位置、最近用过的窗口
type View = { home: boolean; focused: string | null; slot: number; recent: string[] }

const viewKey = 'binos.view'
const initialView: View = { home: true, focused: null, slot: 0, recent: [] }

function loadView(): View {
  try {
    return { ...initialView, ...(JSON.parse(localStorage.getItem(viewKey) ?? '{}') as Partial<View>) }
  } catch {
    return initialView
  }
}

const appOrder = (apps: AppManifest[], appId: string) => apps.findIndex((app) => app.id === appId)

export function Shell() {
  const loaded = useAppsLoaded()
  const apps = useApps()
  const [main, size] = useElementSize<HTMLDivElement>()
  const stored = useWindows()
  const [titles, setTitles] = useState<Record<string, string>>({})
  const onTitle = useCallback((id: string, title: string) => setTitles((prev) => (prev[id] === title ? prev : { ...prev, [id]: title })), [])
  const [view, setView] = useState(loadView)
  const [split, setSplit] = useState<string | null>(null)
  const placement = useBarPlacement()

  useEffect(() => localStorage.setItem(viewKey, JSON.stringify(view)), [view])

  const windows: OpenWindow[] = Object.entries(stored.windows)
    .map(([id, win]) => {
      const appName = findApp(apps, win.app)?.name ?? win.app
      return { id, window: win, title: titles[id] ? `${appName} · ${titles[id]}` : appName }
    })
    .sort((a, b) => appOrder(apps, a.window.app) - appOrder(apps, b.window.app))
  const ids = windows.map((item) => item.id)

  const { workspace } = stored
  const allowed: LayoutId[] = size ? allowedLayouts(size) : ['1']
  const layout = fitLayout(workspace.layout, allowed)
  const portrait = size ? isPortrait(size) : false
  const count = layouts[layout].length
  const recent = view.recent.filter((id) => ids.includes(id))
  const focusedWindow = view.focused && ids.includes(view.focused) ? view.focused : (recent[0] ?? null)
  const panes = arrange(workspace, layout, focusedWindow)
  const slot = Math.min(view.slot, count - 1)
  const focused = panes[slot]
  const home = view.home || panes.every((id) => id === null)

  const focus = (id: string | null, at: number) =>
    setView((prev) =>
      !prev.home && prev.slot === at && (id === null || prev.focused === id)
        ? prev
        : { home: false, focused: id ?? prev.focused, slot: at, recent: id ? [id, ...prev.recent.filter((item) => item !== id)].slice(0, 20) : prev.recent },
    )

  // 分屏时：指定了位置就挪到那里，和原来的窗口对调；没指定时，已经显示着就只聚焦，否则放进聚焦的位置。
  // 只有一个位置时只改显示哪个
  const show = (id: string, target?: number) => {
    if (count === 1) {
      focus(id, 0)
      return
    }
    const at = panes.indexOf(id)
    const to = target ?? (at >= 0 ? at : slot)
    if (at !== to) {
      updateWorkspace((current) => place(current, id, to))
    }
    focus(id, to)
  }

  const open = (appId: string, route?: string, target?: number) => {
    const id = ensureWindow(appId)
    if (route) {
      setRoute(id, route)
    }
    show(id, target)
  }

  const chooseLayout = (next: LayoutId) => {
    if (next !== workspace.layout) saveWorkspace({ ...workspace, layout: next })
  }

  const exitSplit = (keep: number) => {
    const id = panes[keep]
    saveWorkspace({ layout: '1', slots: [id, null] })
    focus(id, 0)
  }

  const close = () => {
    if (!focused) return
    const next = count > 1 ? panes.find((id) => id !== focused) ?? null : recent.find((id) => id !== focused) ?? null
    closeWindow(focused)
    saveWorkspace({ layout: '1', slots: [next, null] })
    setView((prev) => ({ ...prev, home: !next, focused: next, slot: 0 }))
  }

  // 浏览器返回时，恢复那条记录的窗口和路由
  useEffect(() => {
    const onPopState = () => {
      const state = window.history.state as HistoryState
      if (state && ids.includes(state.window)) {
        restoreRoute(state.window, state.route)
        setRoute(state.window, state.route)
        show(state.window)
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  })

  return (
    <div className={styles.shell} data-bar={placement}>
      <div className={styles.titleBar} />
      <div ref={main} className={styles.screen}>
        {loaded && size && (
          <>
            <Workspace
              windows={windows}
              panes={panes}
              layout={layout}
              hidden={home}
              onFocus={focus}
              onLayout={chooseLayout}
              onExit={exitSplit}
              size={size}
              portrait={portrait}
              onTitle={onTitle}
            />
            {home && <Desktop width={size.width} onOpen={open} />}
            {split && stored.windows[split] && allowed.includes('1:1') && (
              <SplitPicker
                app={stored.windows[split].app}
                portrait={portrait}
                onCancel={() => setSplit(null)}
                onChoose={(appId, side) => {
                  const second = ensureWindow(appId)
                  const slots = side === 0 ? [split, second] : [second, split]
                  saveWorkspace({ layout: '1:1', slots })
                  focus(split, side)
                  setSplit(null)
                }}
              />
            )}
          </>
        )}
      </div>
      {placement !== 'hidden' && (
        <TaskBar
          placement={placement}
          windows={windows}
          panes={panes}
          focused={focused}
          focusedSlot={slot}
          home={home}
          layout={layout}
          allowed={allowed}
          portrait={portrait}
          onHome={() => setView((prev) => ({ ...prev, home: !home }))}
          onShow={show}
          onSplit={() => focused && setSplit(focused)}
          onClose={close}
        />
      )}
      <ConnectionStatus />
    </div>
  )
}

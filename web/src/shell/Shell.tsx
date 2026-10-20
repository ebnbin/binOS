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
import { allowedLayouts, arrange, fitLayout, isPortrait } from './layout.ts'
import type { LayoutId, Workspace as WorkspaceState } from './layout.ts'
import { TaskBar } from './TaskBar.tsx'
import { Workspace } from './Workspace.tsx'
import { closeWindow, createGroup, dissolveGroup, ensureWindow, setRoute, updateGroup, useWindows } from './windows.ts'
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
  const [draft, setDraft] = useState<WorkspaceState | null>(null)
  const placement = useBarPlacement()

  useEffect(() => localStorage.setItem(viewKey, JSON.stringify(view)), [view])

  const windows: OpenWindow[] = Object.entries(stored.windows)
    .map(([id, win]) => {
      const appName = findApp(apps, win.app)?.name ?? win.app
      return { id, window: win, title: titles[id] ? `${appName} · ${titles[id]}` : appName }
    })
    .sort((a, b) => appOrder(apps, a.window.app) - appOrder(apps, b.window.app))
  const ids = windows.map((item) => item.id)

  const allowed: LayoutId[] = size ? allowedLayouts(size) : ['1']
  const portrait = size ? isPortrait(size) : false
  const recent = view.recent.filter((id) => ids.includes(id))
  const focusedWindow = view.focused && ids.includes(view.focused) ? view.focused : (recent[0] ?? null)
  const group = stored.groups.find((item) => focusedWindow && item.slots.includes(focusedWindow))
  const workspace: WorkspaceState = draft ?? group ?? { layout: '1', slots: [focusedWindow, null] }
  const layout = fitLayout(workspace.layout, allowed, workspace.slots.indexOf(focusedWindow))
  const panes = arrange(workspace, layout, focusedWindow)
  const slot = Math.max(0, panes.indexOf(focusedWindow))
  const focused = panes[slot]
  const home = !draft && (view.home || panes.every((id) => id === null))

  const focus = (id: string | null, at: number) =>
    setView((prev) =>
      !prev.home && prev.slot === at && (id === null || prev.focused === id)
        ? prev
        : { home: false, focused: id ?? prev.focused, slot: at, recent: id ? [id, ...prev.recent.filter((item) => item !== id)].slice(0, 20) : prev.recent },
    )

  const show = (id: string) => {
    if (draft) return
    const target = stored.groups.find((item) => item.slots.includes(id))
    focus(id, target?.slots.indexOf(id) ?? 0)
  }

  const open = (appId: string, route?: string) => {
    if (draft) return
    const id = ensureWindow(appId)
    if (route) setRoute(id, route)
    show(id)
  }

  const chooseLayout = (next: LayoutId) => {
    if (!draft && group && next !== group.layout) updateGroup(group.id, { ...group, layout: next })
  }

  const exitSplit = (keep: number) => {
    if (draft) { setDraft(null); return }
    const id = panes[keep]
    if (group) dissolveGroup(group.id)
    if (id) focus(id, 0)
  }

  const close = () => {
    if (draft || !focused) return
    const next = group ? group.slots.find((id) => id !== focused) ?? null : recent.find((id) => id !== focused) ?? null
    closeWindow(focused)
    setView((prev) => ({ ...prev, home: !next, focused: next, slot: 0 }))
  }

  if (draft && (!allowed.includes(draft.layout) || !stored.windows[draft.slots[0]!])) setDraft(null)

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
              onPick={(appId) => {
                if (!draft || !draft.slots[0]) return
                const existing = windows.find((item) => item.window.app === appId)
                if (existing && stored.groups.some((item) => item.slots.includes(existing.id))) return
                const id = ensureWindow(appId)
                createGroup({ layout: draft.layout, slots: [draft.slots[0], id] })
                setDraft(null)
                focus(id, 1)
              }}
              picking={draft !== null}
              unavailableApps={windows.filter((item) => stored.groups.some((group) => group.slots.includes(item.id))).map((item) => item.window.app)}
              onSwap={() => {
                if (draft || !group) return
                updateGroup(group.id, { ...group, slots: [...group.slots].reverse() })
                if (focused) focus(focused, 1 - slot)
              }}
              onCancel={() => exitSplit(slot)}
              size={size}
              portrait={portrait}
              onTitle={onTitle}
            />
            {home && <Desktop width={size.width} onOpen={open} />}
          </>
        )}
      </div>
      {placement !== 'hidden' && (
        <TaskBar
          placement={placement}
          windows={windows}
          groups={stored.groups}
          locked={draft !== null}
          panes={panes}
          focused={focused}
          focusedSlot={slot}
          home={home}
          layout={layout}
          allowed={allowed}
          portrait={portrait}
          onHome={() => { if (!draft) setView((prev) => ({ ...prev, home: !home })) }}
          onShow={show}
          onSplit={() => {
            if (draft || !focused) return
            if (group) { exitSplit(slot); return }
            setDraft({ layout: fitLayout('1:1', allowed), slots: [focused, null] })
          }}
          onClose={close}
        />
      )}
      <ConnectionStatus />
    </div>
  )
}

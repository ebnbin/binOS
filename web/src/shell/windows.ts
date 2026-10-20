import type { JsonValue } from '@binos/server/types'
import { useSyncExternalStore } from 'react'
import { normalizeWorkspace } from './layout.ts'
import type { Workspace } from './layout.ts'

// 开着哪些窗口（各自在 app 的哪一页）和分屏布局，每台设备各自记在本地，不同步。每个 app 最多一个窗口。
// 屏幕放不下选的布局时临时降级，不改这里
export type WindowState = { app: string; route: string }

type Stored = { windows: Record<string, WindowState>; workspace: Workspace }

const storageKey = 'binos.windows'
const listeners = new Set<() => void>()

function load(): Stored {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as { windows?: Record<string, WindowState>; workspace?: JsonValue } | null
    const windows = value?.windows ?? {}
    return { windows, workspace: normalizeWorkspace(value?.workspace ?? null, Object.keys(windows)) }
  } catch {
    return { windows: {}, workspace: normalizeWorkspace(null, []) }
  }
}

let stored = load()

function save(next: Stored) {
  next = { ...next, workspace: normalizeWorkspace(next.workspace, Object.keys(next.windows)) }
  stored = next
  localStorage.setItem(storageKey, JSON.stringify(next))
  listeners.forEach((listener) => listener())
}

// 同一台设备上别的标签页改了，跟着变
window.addEventListener('storage', (event) => {
  if (event.key === storageKey) {
    stored = load()
    listeners.forEach((listener) => listener())
  }
})

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useWindows(): Stored {
  return useSyncExternalStore(subscribe, () => stored)
}

export function saveWorkspace(workspace: Workspace) {
  save({ ...stored, workspace })
}

export function updateWorkspace(change: (workspace: Workspace) => Workspace) {
  saveWorkspace(change(stored.workspace))
}

// 已经开着就返回原来的窗口
export function ensureWindow(appId: string): string {
  const existing = Object.entries(stored.windows).find(([, value]) => value.app === appId)
  if (existing) {
    return existing[0]
  }
  const id = crypto.randomUUID()
  save({ ...stored, windows: { ...stored.windows, [id]: { app: appId, route: '/' } } })
  return id
}

export function closeWindow(id: string) {
  const { [id]: _closed, ...windows } = stored.windows
  save({ windows, workspace: { ...stored.workspace, slots: stored.workspace.slots.map((slot) => (slot === id ? null : slot)) } })
}

export function setRoute(id: string, route: string) {
  const current = stored.windows[id]
  if (current && current.route !== route) {
    save({ ...stored, windows: { ...stored.windows, [id]: { ...current, route } } })
  }
}

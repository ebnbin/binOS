import type { JsonValue } from '@binos/server/types'
import { useSyncExternalStore } from 'react'
import { normalizeGroups, normalizeWorkspace } from './layout.ts'
import type { SplitGroup, Workspace } from './layout.ts'

// 开着哪些窗口（各自在 app 的哪一页）和分屏布局，每台设备各自记在本地，不同步。每个 app 最多一个窗口。
// 屏幕放不下选的布局时临时降级，不改这里
export type WindowState = { app: string; route: string }

type Stored = { windows: Record<string, WindowState>; groups: SplitGroup[] }

const storageKey = 'binos.windows'
const listeners = new Set<() => void>()

function load(): Stored {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as { windows?: Record<string, WindowState>; workspace?: JsonValue; groups?: JsonValue } | null
    const windows = value?.windows ?? {}
    const ids = Object.keys(windows)
    const legacy = normalizeWorkspace(value?.workspace ?? null, ids)
    const groups = normalizeGroups(value?.groups ?? (legacy.layout !== '1' ? [{ ...legacy, id: 'legacy' }] : []), ids)
    return { windows, groups }
  } catch {
    return { windows: {}, groups: [] }
  }
}

let stored = load()

function save(next: Stored) {
  next = { ...next, groups: normalizeGroups(next.groups, Object.keys(next.windows)) }
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

export function createGroup(workspace: Workspace) {
  save({ ...stored, groups: [...stored.groups, { ...workspace, id: crypto.randomUUID() } as SplitGroup] })
}

export function updateGroup(id: string, workspace: Workspace) {
  save({ ...stored, groups: stored.groups.map((group) => group.id === id ? { ...workspace, id } as SplitGroup : group) })
}

export function dissolveGroup(id: string) {
  save({ ...stored, groups: stored.groups.filter((group) => group.id !== id) })
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
  save({ windows, groups: stored.groups.filter((group) => !group.slots.includes(id)) })
}

export function setRoute(id: string, route: string) {
  const current = stored.windows[id]
  if (current && current.route !== route) {
    save({ ...stored, windows: { ...stored.windows, [id]: { ...current, route } } })
  }
}

import { getState, listState, updateState } from '../state.ts'
import { normalizeWorkspace } from './layout.ts'
import type { Workspace } from './layout.ts'

// 系统状态，所有设备共用：
// shell/windows/<id> → { app, route }：开着哪些窗口、各自在 app 的哪一页。每个 app 最多一个窗口
// shell/workspace → { layout, slots }：选的分屏布局和每个位置上的窗口。屏幕放不下时各设备自己降级，不改这里
// 显示桌面还是窗口、聚焦哪个窗口，每台设备各自记在本地
export type WindowState = { app: string; route: string }

export const windowPrefix = 'shell/windows/'
export const workspaceKey = 'shell/workspace'

const readWorkspace = () => {
  const ids = listState(windowPrefix).map(([key]) => key.slice(windowPrefix.length))
  return normalizeWorkspace(getState(workspaceKey), ids)
}

export function saveWorkspace(workspace: Workspace) {
  updateState([{ key: workspaceKey, value: workspace }])
}

export function updateWorkspace(change: (workspace: Workspace) => Workspace) {
  saveWorkspace(change(readWorkspace()))
}

// 已经开着就返回原来的窗口
export function ensureWindow(appId: string): string {
  const existing = listState(windowPrefix).find(([, value]) => (value as WindowState).app === appId)
  if (existing) {
    return existing[0].slice(windowPrefix.length)
  }
  const id = crypto.randomUUID()
  updateState([{ key: windowPrefix + id, value: { app: appId, route: '/' } }])
  return id
}

export function closeWindow(id: string) {
  const workspace = readWorkspace()
  updateState([
    { key: windowPrefix + id, value: null },
    { key: workspaceKey, value: { ...workspace, slots: workspace.slots.map((slot) => (slot === id ? null : slot)) } },
  ])
}

export function setRoute(id: string, route: string) {
  const current = getState(windowPrefix + id) as WindowState | null
  if (current && current.route !== route) {
    updateState([{ key: windowPrefix + id, value: { ...current, route } }])
  }
}

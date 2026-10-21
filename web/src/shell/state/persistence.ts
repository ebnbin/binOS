import type { WindowInstance } from './types.ts'

export type StoredWindow = { app: string; route: string; viewId?: string }

// 默认主界面沿用原来的存储格式，旧标签页和现有设备状态仍能读取。
export function readWindows(windows: Record<string, StoredWindow>): Record<string, WindowInstance> {
  return Object.fromEntries(Object.entries(windows).map(([id, win]) => [id, {
    id, applicationId: win.app, viewId: win.viewId ?? 'main', route: win.route,
  }]))
}

export function writeWindows(windows: Record<string, WindowInstance>): Record<string, StoredWindow> {
  return Object.fromEntries(Object.entries(windows).map(([id, win]) => [id, {
    app: win.applicationId, route: win.route, ...(win.viewId === 'main' ? {} : { viewId: win.viewId }),
  }]))
}

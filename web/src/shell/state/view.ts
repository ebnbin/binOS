import { useEffect, useState } from 'react'

// 这台设备自己的界面状态（窗口和分屏布局见 windows.ts）：显示桌面还是窗口、聚焦的窗口和分屏位置、最近用过的窗口
export type ShellViewState = { home: boolean; focused: string | null; slot: number; recent: string[] }

const viewKey = 'binos.view'
const initialShellViewState: ShellViewState = { home: true, focused: null, slot: 0, recent: [] }

function loadShellViewState(): ShellViewState {
  try {
    return { ...initialShellViewState, ...(JSON.parse(localStorage.getItem(viewKey) ?? '{}') as Partial<ShellViewState>) }
  } catch {
    return initialShellViewState
  }
}

export function useShellViewState() {
  const [view, setView] = useState(loadShellViewState)
  useEffect(() => localStorage.setItem(viewKey, JSON.stringify(view)), [view])
  return [view, setView] as const
}

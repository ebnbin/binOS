import { Suspense, useEffect, useMemo } from 'react'
import { apps } from '../apps/index.ts'
import type { AppContext } from '../apps/types.ts'
import { getState, listState, updateState, useStateList, useStateLoaded } from '../state.ts'
import { ConnectionStatus } from './ConnectionStatus.tsx'
import styles from './Shell.module.css'

// 窗口存在系统状态里，所有设备共用：shell/windows/<窗口 id> → { app, route }
const windowPrefix = 'shell/windows/'
type WindowState = { app: string; route: string }

// 网址始终是 /。在 app 里跳转时增加一条网址不变的历史记录，返回时据此恢复那个窗口的路由。
// pushed：这条记录是 binOS 在页面内跳转时加的，它的上一条也属于 binOS
type HistoryState = { window: string; route: string; pushed: boolean } | null

const historyState = () => window.history.state as HistoryState

function setRoute(window: string, route: string) {
  const current = getState(windowPrefix + window) as WindowState | null
  if (current) {
    updateState([{ key: windowPrefix + window, value: { ...current, route } }])
  }
}

export function Shell() {
  const loaded = useStateLoaded()
  const windows = useStateList(windowPrefix)
  const [key, value] = windows[0] ?? []
  const id = key?.slice(windowPrefix.length)
  const { app, route } = (value ?? {}) as Partial<WindowState>

  useEffect(() => {
    // 读最新的状态，不用渲染时的：开发时 StrictMode 会把 effect 连续执行两次
    if (loaded && !listState(windowPrefix).length) {
      updateState([{ key: windowPrefix + crypto.randomUUID(), value: { app: apps[0].id, route: '/' } }])
    }
  }, [loaded, windows.length])

  useEffect(() => {
    if (id !== undefined && route !== undefined && historyState()?.window !== id) {
      window.history.replaceState({ window: id, route, pushed: false } satisfies HistoryState, '', '/')
    }
  }, [id, route])

  useEffect(() => {
    const onPopState = () => {
      const state = historyState()
      if (state) {
        setRoute(state.window, state.route)
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const ctx = useMemo<AppContext | undefined>(() => {
    if (id === undefined || route === undefined) {
      return undefined
    }
    const navigate: AppContext['navigate'] = (next, { replace = false } = {}) => {
      if (replace || next === route) {
        window.history.replaceState({ window: id, route: next, pushed: historyState()?.pushed ?? false } satisfies HistoryState, '', '/')
      } else {
        window.history.pushState({ window: id, route: next, pushed: true } satisfies HistoryState, '', '/')
      }
      setRoute(id, next)
    }
    return {
      route,
      navigate,
      back: () => (historyState()?.pushed ? window.history.back() : navigate('/', { replace: true })),
      setTitle: (title) => {
        document.title = title ? `${title} - binOS` : 'binOS'
      },
    }
  }, [id, route])

  const App = apps.find((manifest) => manifest.id === app)?.component
  return (
    <div className={styles.shell}>
      {App && ctx && (
        <Suspense>
          <App ctx={ctx} />
        </Suspense>
      )}
      <ConnectionStatus />
    </div>
  )
}

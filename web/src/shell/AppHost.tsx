import { Component, Suspense, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { findApp } from '../apps/index.ts'
import type { AppContext } from '../apps/types.ts'
import styles from './AppHost.module.css'
import { setRoute } from './windows.ts'
import type { WindowState } from './windows.ts'

// 网址始终是 /。在 app 里跳转时增加一条网址不变的历史记录，返回时 Shell 据此恢复那个窗口的路由并聚焦它。
// pushed：这条记录是 binOS 在页面内跳转时加的，它的上一条也属于 binOS
export type HistoryState = { window: string; route: string; pushed: boolean } | null

const historyState = () => window.history.state as HistoryState

// 一个窗口里的 app。出错时只影响这个窗口
export function AppHost({ id, window: win, onTitle }: { id: string; window: WindowState; onTitle: (id: string, title: string) => void }) {
  const [attempt, setAttempt] = useState(0)
  const { route } = win
  const ctx = useMemo<AppContext>(() => {
    const navigate: AppContext['navigate'] = (next, { replace = false } = {}) => {
      if (replace || next === route) {
        window.history.replaceState({ window: id, route: next, pushed: historyState()?.pushed ?? false } satisfies HistoryState, '', '/')
      } else {
        // 先把当前这一条记成跳转前的样子，返回时才能回到这里
        window.history.replaceState({ window: id, route, pushed: historyState()?.pushed ?? false } satisfies HistoryState, '', '/')
        window.history.pushState({ window: id, route: next, pushed: true } satisfies HistoryState, '', '/')
      }
      setRoute(id, next)
    }
    return {
      route,
      navigate,
      back: () => (historyState()?.pushed ? window.history.back() : navigate('/', { replace: true })),
      setTitle: (title) => onTitle(id, title),
    }
  }, [id, route, onTitle])

  const App = findApp(win.app)?.component
  if (!App) {
    return <div className={styles.message}>找不到 app「{win.app}」</div>
  }
  return (
    <ErrorBoundary key={attempt} onRetry={() => setAttempt(attempt + 1)}>
      <Suspense>
        <App ctx={ctx} />
      </Suspense>
    </ErrorBoundary>
  )
}

class ErrorBoundary extends Component<{ children: ReactNode; onRetry: () => void }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) {
      return this.props.children
    }
    return (
      <div className={styles.message}>
        <p>这个 app 出错了</p>
        <button type="button" onClick={this.props.onRetry}>
          重新打开
        </button>
      </div>
    )
  }
}

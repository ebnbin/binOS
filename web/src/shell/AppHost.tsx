import { Suspense, useMemo } from 'react'
import { findApp, useApps } from '../apps/index.ts'
import type { AppContext } from '../apps/types.ts'
import { ErrorBoundary } from '../ui/ErrorBoundary.tsx'
import styles from './AppHost.module.css'
import { popBack, pushBack } from './history.ts'
import type { HistoryState } from './history.ts'
import { setRoute } from './windows.ts'
import type { WindowState } from './windows.ts'

// 一个窗口里的 app。出错时只影响这个窗口
export function AppHost({ id, window: win, onTitle }: { id: string; window: WindowState; onTitle: (id: string, title: string) => void }) {
  const { route } = win
  const apps = useApps()
  const ctx = useMemo<AppContext>(() => {
    const navigate: AppContext['navigate'] = (next, { replace = false } = {}) => {
      if (replace || next === route) {
        window.history.replaceState({ window: id, route: next } satisfies HistoryState, '', '/')
      } else {
        // 先把当前这一条记成跳转前的样子，浏览器返回时才能回到这里
        window.history.replaceState({ window: id, route } satisfies HistoryState, '', '/')
        window.history.pushState({ window: id, route: next } satisfies HistoryState, '', '/')
        pushBack(id, route)
      }
      setRoute(id, next)
    }
    return {
      route,
      navigate,
      back: () => navigate(popBack(id) ?? '/', { replace: true }),
      setTitle: (title) => onTitle(id, title),
    }
  }, [id, route, onTitle])

  const App = findApp(apps, win.app)?.component
  if (!App) {
    return <div className={styles.message}>找不到 app「{win.app}」</div>
  }
  return (
    <ErrorBoundary
      fallback={(retry) => (
        <div className={styles.message}>
          <p>这个 app 出错了</p>
          <button type="button" onClick={retry}>
            重新打开
          </button>
        </div>
      )}
    >
      <Suspense>
        <App ctx={ctx} />
      </Suspense>
    </ErrorBoundary>
  )
}

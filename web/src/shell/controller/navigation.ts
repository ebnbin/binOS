import type { WindowContext } from '../../apps/types.ts'
import { setRoute } from '../state/windows.ts'
import { popBack, pushBack } from './history.ts'
import type { HistoryState } from './history.ts'

export function createWindowContext(id: string, route: string, onTitle: (id: string, title: string) => void): WindowContext {
  const navigate: WindowContext['navigate'] = (next, { replace = false } = {}) => {
    if (replace || next === route) {
      window.history.replaceState({ window: id, route: next } satisfies HistoryState, '', '/')
    } else {
      // 先把当前这一条记成跳转前的样子，浏览器返回时才能回到这里。
      window.history.replaceState({ window: id, route } satisfies HistoryState, '', '/')
      window.history.pushState({ window: id, route: next } satisfies HistoryState, '', '/')
      pushBack(id, route)
    }
    setRoute(id, next)
  }
  return {
    windowId: id,
    route,
    navigate,
    back: () => navigate(popBack(id) ?? '/', { replace: true }),
    setTitle: (title) => onTitle(id, title),
  }
}

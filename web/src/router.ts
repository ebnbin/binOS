import { useSyncExternalStore } from 'react'

// /：对话列表；/new：新对话；/s/:id：某个对话
export type Route = { name: 'home' } | { name: 'new' } | { name: 'session'; id: number }

// 页面内跳转产生的历史记录带上这个标记，返回时据此判断上一页是不是 binOS 自己的页面
type HistoryState = { inApp: true } | null

const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('popstate', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('popstate', listener)
  }
}

function parse(path: string): Route {
  if (path === '/new') {
    return { name: 'new' }
  }
  const match = /^\/s\/(\d+)$/.exec(path)
  return match ? { name: 'session', id: Number(match[1]) } : { name: 'home' }
}

export function useRoute(): Route {
  return parse(useSyncExternalStore(subscribe, () => window.location.pathname))
}

export function navigate(path: string, { replace = false } = {}) {
  if (replace || path === window.location.pathname) {
    window.history.replaceState(window.history.state, '', path)
  } else {
    window.history.pushState({ inApp: true } satisfies HistoryState, '', path)
  }
  listeners.forEach((listener) => listener())
}

// 从列表进来的就退回去，和浏览器的返回手势一致；直接打开的链接没有上一页，换成列表
export function back() {
  if ((window.history.state as HistoryState)?.inApp) {
    window.history.back()
  } else {
    navigate('/', { replace: true })
  }
}

export const sessionPath = (id: number) => `/s/${id}`

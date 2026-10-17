import type { SessionSummary } from '@binos/server/types'
import { useCallback, useEffect, useRef, useState } from 'react'
import { listSessions } from './api.ts'

const pollInterval = 10_000

// 其他 session 的状态没有实时推送，靠轮询和回到页面时刷新
export function useSessions() {
  const [sessions, setSessions] = useState<SessionSummary[] | undefined>(undefined)
  const [failed, setFailed] = useState(false)
  const latest = useRef(0)

  const refresh = useCallback(() => {
    const request = ++latest.current
    listSessions()
      .then((result) => {
        if (request === latest.current) {
          setSessions(result)
          setFailed(false)
        }
      })
      .catch(() => {
        if (request === latest.current) {
          setFailed(true)
        }
      })
  }, [])

  useEffect(() => {
    refresh()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }, pollInterval)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [refresh])

  return { sessions, failed, refresh }
}

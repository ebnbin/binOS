import type { SessionSummary } from '@binos/server/apps/code/types'
import { useEffect, useRef, useState } from 'react'
import { listSessions } from './api.ts'
import { onChange } from '../../events.ts'

export function useSessions() {
  const [sessions, setSessions] = useState<SessionSummary[] | undefined>(undefined)
  const [failed, setFailed] = useState(false)
  const latest = useRef(0)

  useEffect(() => {
    const refresh = () => {
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
    }
    refresh()
    return onChange((event) => {
      if (event === null || event.type === 'session') {
        refresh()
      }
    })
  }, [])

  return { sessions, failed }
}

import type { Project, SessionSummary } from '@binos/server/apps/code/types'
import { useEffect, useRef, useState } from 'react'
import { listProjects, listSessions } from './api.ts'
import { onChange } from '../../events.ts'

export function useSessions() {
  const [sessions, setSessions] = useState<SessionSummary[] | undefined>(undefined)
  const [projects, setProjects] = useState<Project[]>()
  const [failed, setFailed] = useState(false)
  const latest = useRef(0)

  useEffect(() => {
    const refresh = () => {
      const request = ++latest.current
      Promise.all([listSessions(), listProjects()])
        .then(([result, projects]) => {
          if (request === latest.current) {
            setSessions(result)
            setProjects(projects)
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
      if (event === null || event.type === 'session' || event.type === 'project') {
        refresh()
      }
    })
  }, [])

  return { sessions, projects, failed }
}

import type { SessionSummary } from '@binos/server/types'
import { useEffect, useState } from 'react'
import { listSessions } from '../api.ts'

const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' })

export function SessionList({ current, onSelect }: { current: number | null; onSelect: (id: number) => void }) {
  const [sessions, setSessions] = useState<SessionSummary[] | undefined>(undefined)
  const [error, setError] = useState(false)

  useEffect(() => {
    listSessions()
      .then(setSessions)
      .catch(() => setError(true))
  }, [])

  if (error) {
    return <p className="empty">读取失败</p>
  }
  if (!sessions) {
    return <p className="empty">正在读取…</p>
  }
  if (sessions.length === 0) {
    return <p className="empty">还没有 session</p>
  }
  return (
    <ul className="sessions">
      {sessions.map((session) => (
        <li key={session.id}>
          <button
            type="button"
            className={session.id === current ? 'current' : undefined}
            onClick={() => onSelect(session.id)}
          >
            <span className="session-title">{session.title || '（无内容）'}</span>
            <span className="session-meta">
              #{session.id}
              {session.updatedAt && ` · ${timeFormat.format(new Date(session.updatedAt))}`}
              {session.running && ' · 进行中'}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

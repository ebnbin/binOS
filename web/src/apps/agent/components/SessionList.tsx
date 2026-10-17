import type { SessionSummary } from '@binos/server/apps/agent/types'
import { SquarePen } from 'lucide-react'
import { formatTime } from '../time.ts'
import styles from './SessionList.module.css'
import { BrandMark } from '../../../ui/BrandMark.tsx'

export function SessionList({
  sessions,
  failed,
  current,
  onNavigate,
}: {
  sessions: SessionSummary[] | undefined
  failed: boolean
  current: number | null
  onNavigate: (route: string) => void
}) {
  return (
    <div className={styles.pane}>
      <header className={styles.brand}>
        <BrandMark />
        <span className={styles.wordmark}>binOS</span>
      </header>
      <button type="button" className={styles.newButton} onClick={() => onNavigate('/new')}>
        <SquarePen size={16} strokeWidth={1.75} />
        新对话
      </button>
      <div className={styles.label}>对话</div>
      <nav className={styles.list}>
        <SessionItems sessions={sessions} failed={failed} current={current} onNavigate={onNavigate} />
      </nav>
    </div>
  )
}

function SessionItems({
  sessions,
  failed,
  current,
  onNavigate,
}: {
  sessions: SessionSummary[] | undefined
  failed: boolean
  current: number | null
  onNavigate: (route: string) => void
}) {
  if (!sessions) {
    return failed ? <p className={styles.placeholder}>读取失败</p> : null
  }
  if (sessions.length === 0) {
    return <p className={styles.placeholder}>还没有对话</p>
  }
  return (
    <ul>
      {sessions.map((session) => (
        <li key={session.id}>
          <button
            type="button"
            className={styles.item}
            aria-current={session.id === current ? 'page' : undefined}
            onClick={() => onNavigate(`/${session.id}`)}
          >
            <span className={styles.title}>{session.title || '（无内容）'}</span>
            {session.running ? (
              <span className={styles.live} aria-label="进行中" />
            ) : (
              session.updatedAt && <span className={styles.time}>{formatTime(new Date(session.updatedAt))}</span>
            )}
          </button>
        </li>
      ))}
    </ul>
  )
}

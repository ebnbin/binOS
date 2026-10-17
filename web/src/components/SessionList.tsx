import type { SessionSummary } from '@binos/server/types'
import { SquarePen } from 'lucide-react'
import { sessionPath } from '../router.ts'
import { formatTime } from '../time.ts'
import styles from './SessionList.module.css'
import { BrandMark } from './ui/BrandMark.tsx'
import { Link } from './ui/Link.tsx'

export function SessionList({
  sessions,
  failed,
  current,
}: {
  sessions: SessionSummary[] | undefined
  failed: boolean
  current: number | null
}) {
  return (
    <div className={styles.pane}>
      <header className={styles.brand}>
        <BrandMark />
        <span className={styles.wordmark}>binOS</span>
      </header>
      <Link to="/new" className={styles.newButton}>
        <SquarePen size={16} strokeWidth={1.75} />
        新对话
      </Link>
      <div className={styles.label}>对话</div>
      <nav className={styles.list}>
        <SessionItems sessions={sessions} failed={failed} current={current} />
      </nav>
    </div>
  )
}

function SessionItems({
  sessions,
  failed,
  current,
}: {
  sessions: SessionSummary[] | undefined
  failed: boolean
  current: number | null
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
          <Link
            to={sessionPath(session.id)}
            className={styles.item}
            aria-current={session.id === current ? 'page' : undefined}
          >
            <span className={styles.title}>{session.title || '（无内容）'}</span>
            {session.running ? (
              <span className={styles.live} aria-label="进行中" />
            ) : (
              session.updatedAt && <span className={styles.time}>{formatTime(new Date(session.updatedAt))}</span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  )
}

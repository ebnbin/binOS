import type { SessionSummary } from '@binos/server/types'
import { SquarePen } from 'lucide-react'
import { useEffect } from 'react'
import { formatTime } from '../time.ts'
import styles from './Sidebar.module.css'
import { BrandMark } from './ui/BrandMark.tsx'

export function Sidebar({
  sessions,
  failed,
  current,
  open,
  onSelect,
  onNew,
  onClose,
}: {
  sessions: SessionSummary[] | undefined
  failed: boolean
  current: number | null | undefined
  open: boolean
  onSelect: (id: number) => void
  onNew: () => void
  onClose: () => void
}) {
  useEffect(() => {
    if (!open) {
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  return (
    <>
      <div className={styles.scrim} data-open={open} onClick={onClose} />
      <aside className={styles.sidebar} data-open={open}>
        <div className={styles.brand}>
          <BrandMark />
          <span className={styles.wordmark}>binOS</span>
        </div>
        <button type="button" className={styles.newButton} onClick={onNew} disabled={current === null}>
          <SquarePen size={16} strokeWidth={1.75} />
          新对话
        </button>
        <div className={styles.label}>对话</div>
        <nav className={styles.list}>
          <SessionItems sessions={sessions} failed={failed} current={current} onSelect={onSelect} />
        </nav>
      </aside>
    </>
  )
}

function SessionItems({
  sessions,
  failed,
  current,
  onSelect,
}: {
  sessions: SessionSummary[] | undefined
  failed: boolean
  current: number | null | undefined
  onSelect: (id: number) => void
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
            onClick={() => onSelect(session.id)}
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

import type { SessionSummary } from '@binos/server/apps/agent/types'
import { Archive, ArchiveRestore, ChevronRight, CircleAlert, Hourglass, MoreHorizontal, Pencil, Pin, PinOff, Search, SquarePen, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { editSession, listSessions } from '../api.ts'
import { formatTime } from '../time.ts'
import { Quota } from './Quota.tsx'
import styles from './SessionList.module.css'

// 输入停下这么久才去搜
const searchDelay = 250

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
  const [query, setQuery] = useState('')
  const matched = useSearch(query.trim())
  return (
    <div className={styles.pane}>
      <header className={styles.brand}>
        <span className={styles.wordmark}>Agent</span>
        <Quota />
      </header>
      <button type="button" className={styles.newButton} onClick={() => onNavigate('/new')}>
        <SquarePen size={16} strokeWidth={1.75} />
        新对话
      </button>
      <label className={styles.search}>
        <Search size={14} strokeWidth={1.75} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索对话" aria-label="搜索对话" />
        {query && (
          <button type="button" className={styles.clear} onClick={() => setQuery('')} aria-label="清除搜索">
            <X size={13} strokeWidth={2} />
          </button>
        )}
      </label>
      <nav className={styles.list}>
        <Sections
          sessions={sessions && matched ? sessions.filter((session) => matched.has(session.id)) : sessions}
          searching={query.trim() !== ''}
          failed={failed}
          current={current}
          onNavigate={onNavigate}
        />
      </nav>
    </div>
  )
}

// 搜索结果是匹配的 session 编号；没在搜时是 undefined
function useSearch(query: string): Set<number> | undefined {
  const [result, setResult] = useState<{ query: string; ids: Set<number> }>()
  useEffect(() => {
    if (!query) {
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      listSessions(query)
        .then((found) => !cancelled && setResult({ query, ids: new Set(found.map((session) => session.id)) }))
        .catch(() => {})
    }, searchDelay)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query])
  // 这次的结果回来之前，先用上一次的；还没有搜过就先显示全部
  return query ? result?.ids : undefined
}

// 置顶的在最上面，归档的收在最下面
function Sections({
  sessions,
  searching,
  failed,
  current,
  onNavigate,
}: {
  sessions: SessionSummary[] | undefined
  searching: boolean
  failed: boolean
  current: number | null
  onNavigate: (route: string) => void
}) {
  const [showArchived, setShowArchived] = useState(false)
  if (!sessions) {
    return failed ? <p className={styles.placeholder}>读取失败</p> : null
  }
  if (sessions.length === 0) {
    return <p className={styles.placeholder}>{searching ? '没有找到' : '还没有对话'}</p>
  }
  const pinned = sessions.filter((session) => session.pinned && !session.archived)
  const others = sessions.filter((session) => !session.pinned && !session.archived)
  const archived = sessions.filter((session) => session.archived)
  const items = (list: SessionSummary[]) => (
    <ul>
      {list.map((session) => (
        <SessionItem key={session.id} session={session} current={session.id === current} onNavigate={onNavigate} />
      ))}
    </ul>
  )
  return (
    <>
      {pinned.length > 0 && (
        <>
          <div className={styles.label}>置顶</div>
          {items(pinned)}
        </>
      )}
      {others.length > 0 && (
        <>
          <div className={styles.label}>对话</div>
          {items(others)}
        </>
      )}
      {archived.length > 0 && (
        <>
          <button type="button" className={styles.archivedToggle} onClick={() => setShowArchived(!showArchived)} aria-expanded={showArchived}>
            <ChevronRight size={13} strokeWidth={2} className={styles.toggleChevron} />
            已归档 {archived.length}
          </button>
          {(showArchived || searching) && items(archived)}
        </>
      )}
    </>
  )
}

function SessionItem({
  session,
  current,
  onNavigate,
}: {
  session: SessionSummary
  current: boolean
  onNavigate: (route: string) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  return (
    <li className={styles.row} data-menu-open={menuOpen || undefined}>
      {renaming ? (
        <RenameInput
          title={session.title}
          onDone={(title) => {
            setRenaming(false)
            if (title && title !== session.title) {
              void editSession(session.id, { title })
            }
          }}
        />
      ) : (
        <button
          type="button"
          className={styles.item}
          aria-current={current ? 'page' : undefined}
          onClick={() => onNavigate(`/${session.id}`)}
        >
          <span className={styles.title} data-unread={session.unread || undefined}>
            {session.title || '（无内容）'}
          </span>
          <SessionStatus session={session} />
        </button>
      )}
      {!renaming && (
        <button
          type="button"
          className={styles.more}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="更多操作"
          aria-expanded={menuOpen}
        >
          <MoreHorizontal size={15} strokeWidth={1.75} />
        </button>
      )}
      {menuOpen && (
        <Menu onClose={() => setMenuOpen(false)}>
          <button type="button" onClick={() => setRenaming(true)}>
            <Pencil size={14} strokeWidth={1.75} />
            重命名
          </button>
          <button type="button" onClick={() => void editSession(session.id, { pinned: !session.pinned })}>
            {session.pinned ? <PinOff size={14} strokeWidth={1.75} /> : <Pin size={14} strokeWidth={1.75} />}
            {session.pinned ? '取消置顶' : '置顶'}
          </button>
          <button type="button" onClick={() => void editSession(session.id, { archived: !session.archived })}>
            {session.archived ? <ArchiveRestore size={14} strokeWidth={1.75} /> : <Archive size={14} strokeWidth={1.75} />}
            {session.archived ? '取消归档' : '归档'}
          </button>
        </Menu>
      )}
    </li>
  )
}

// 正在回答、在等后台任务、出错、未读，都没有时显示时间
function SessionStatus({ session }: { session: SessionSummary }) {
  if (session.running) {
    return <span className={styles.live} aria-label="正在回答" title="正在回答" />
  }
  if (session.waiting) {
    return <Hourglass size={13} strokeWidth={1.75} className={styles.waiting} aria-label="等待后台任务" />
  }
  if (session.outcome === 'error') {
    return <CircleAlert size={14} strokeWidth={1.75} className={styles.error} aria-label="出错了" />
  }
  if (session.unread) {
    return <span className={styles.unread} aria-label="有新回复" title="有新回复" />
  }
  return session.updatedAt ? <span className={styles.time}>{formatTime(new Date(session.updatedAt))}</span> : null
}

function RenameInput({ title, onDone }: { title: string; onDone: (title: string | undefined) => void }) {
  const [value, setValue] = useState(title)
  return (
    <input
      className={styles.rename}
      value={value}
      autoFocus
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => onDone(value.trim() || undefined)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
          event.currentTarget.blur()
        } else if (event.key === 'Escape') {
          onDone(undefined)
        }
      }}
      aria-label="新的名字"
    />
  )
}

// 点菜单外面、按 Esc、或者选了一项后关上
function Menu({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.parentElement?.contains(event.target as Node)) {
        onClose()
      }
    }
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])
  return (
    <div ref={ref} className={styles.menu} role="menu" onClick={onClose}>
      {children}
    </div>
  )
}

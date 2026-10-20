import type { SessionSummary } from '@binos/server/apps/code/types'
import { agents, defaultProvider } from '@binos/server/services/agent/types'
import { ChevronRight, CircleAlert, CircleStop, Clock, GitPullRequest, Hourglass, MoreHorizontal, Search, SquarePen, X } from 'lucide-react'
import { Fragment, useEffect, useState } from 'react'
import { listSessions } from '../api.ts'
import { dateGroup, formatClock, formatTime } from '../time.ts'
import { AuthBanner } from './AuthBanner.tsx'
import { Quota } from './Quota.tsx'
import { Menu, RenameInput, SessionMenuItems } from './SessionMenu.tsx'
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
        <span className={styles.wordmark}>Code</span>
        <Quota />
      </header>
      <AuthBanner />
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

// 置顶的在最上面，其余按最近的动静分成今天、昨天等几组，归档的收在最下面
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
  // clock：所在的分组已经写明了是哪天，只显示时刻
  const items = (list: SessionSummary[], clock = false) => (
    <ul>
      {list.map((session) => (
        <SessionItem key={session.id} session={session} current={session.id === current} clock={clock} onNavigate={onNavigate} />
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
      {[...Map.groupBy(others, (session) => dateGroup(new Date(session.updatedAt)))].map(([group, list]) => (
        <Fragment key={group}>
          <div className={styles.label}>{group}</div>
          {items(list, group === '今天' || group === '昨天')}
        </Fragment>
      ))}
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
  clock,
  onNavigate,
}: {
  session: SessionSummary
  current: boolean
  clock: boolean
  onNavigate: (route: string) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  return (
    <li className={styles.row} data-menu-open={menuOpen || undefined}>
      {renaming ? (
        <RenameInput session={session} onDone={() => setRenaming(false)} />
      ) : (
        <button
          type="button"
          className={styles.item}
          aria-current={current ? 'page' : undefined}
          onClick={() => onNavigate(`/${session.id}`)}
        >
          <span className={styles.line}>
            {session.running ? (
              <span className={styles.live} aria-label="正在回答" />
            ) : (
              session.unread && <span className={styles.unread} aria-label="有新回复" />
            )}
            <span className={styles.title} data-unread={session.unread || undefined}>
              {session.title || '（无内容）'}
            </span>
          </span>
          <SessionMeta session={session} clock={clock} />
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
          <SessionMenuItems session={session} onRename={() => setRenaming(true)} />
        </Menu>
      )}
    </li>
  )
}

// 标题下面一行：编号、不是默认的 agent、轮数、开着的 PR、排队的消息、停止或出错；最右边是在回答、在等后台任务，或者最后有动静的时间
function SessionMeta({ session, clock }: { session: SessionSummary; clock: boolean }) {
  const openPrs = session.prs.filter((pr) => pr.state === 'open')
  const date = new Date(session.updatedAt)
  return (
    <span className={styles.meta}>
      <span>#{session.id}</span>
      {session.provider !== defaultProvider && <span>{agents[session.provider].name}</span>}
      {session.turns > 1 && <span>{session.turns} 轮</span>}
      {openPrs.length > 0 && (
        <span className={styles.openPr} title="开着的 PR">
          <GitPullRequest size={12} strokeWidth={2} />
          {openPrs.map((pr) => `#${pr.number}`).join(' ')}
        </span>
      )}
      {session.queue.length > 0 && (
        <span title="排队的消息">
          <Clock size={12} strokeWidth={2} />
          {session.queue.length}
        </span>
      )}
      {session.outcome && !session.running && !session.waiting && (
        <span className={session.outcome === 'error' ? styles.error : undefined}>
          {session.outcome === 'error' ? <CircleAlert size={12} strokeWidth={2} /> : <CircleStop size={12} strokeWidth={2} />}
          {session.outcome === 'error' ? '出错' : '已停止'}
        </span>
      )}
      <span className={styles.side}>
        {session.running ? (
          <span className={styles.busy}>回答中</span>
        ) : session.waiting ? (
          <span className={styles.busy} title="答完了，在等后台任务">
            <Hourglass size={12} strokeWidth={2} />
            后台任务
          </span>
        ) : (
          session.updatedAt && <time dateTime={session.updatedAt}>{clock ? formatClock(date) : formatTime(date)}</time>
        )}
      </span>
    </span>
  )
}

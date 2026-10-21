import type { SessionSummary } from '@binos/server/apps/code/types'
import { agents, defaultAgent } from '@binos/server/services/agent/types'
import { ChevronRight, CircleAlert, CircleStop, Clock, Gauge, GitPullRequest, Hourglass, MoreHorizontal, Search, SquarePen, X } from 'lucide-react'
import { Fragment, useEffect, useState } from 'react'
import { searchContent } from '../api.ts'
import { onChange } from '../../../events.ts'
import { formatQuota } from '../format.ts'
import { dateGroup, formatClock, formatTime } from '../../../ui/time.ts'
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
  const search = useSearch(query.trim())
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
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索全部历史内容" aria-label="搜索全部历史内容" />
        {query && (
          <button type="button" className={styles.clear} onClick={() => setQuery('')} aria-label="清除搜索">
            <X size={13} strokeWidth={2} />
          </button>
        )}
      </label>
      <nav className={styles.list}>
        {query.trim() ? (
          <div aria-live="polite">
            <p className={styles.placeholder}>{search.failed ? '搜索失败，请修改关键词重试' : !search.data ? '搜索中…' : `找到 ${search.data.total} 条结果${search.data.total > 200 ? '，显示前 200 条' : ''}`}</p>
            {search.data?.results.map((result) => (
              <button type="button" className={styles.item} key={`${result.id}-${result.item ?? 'title'}`}
                onClick={() => onNavigate(`/${result.id}${result.item !== undefined ? `?item=${result.item}` : ''}`)}>
                <span className={styles.title}>{result.title || '（无内容）'}</span>
                <span className={styles.meta}>#{result.id} · {result.kind === 'title' ? '标题' : result.kind === 'input' ? '用户消息' : '回复'}{result.archived ? ' · 已归档' : ''}</span>
                <span className={styles.snippet}>{result.before}<mark>{result.match}</mark>{result.after}</span>
              </button>
            ))}
          </div>
        ) : <Sections
          sessions={sessions}
          searching={false}
          failed={failed}
          current={current}
          onNavigate={onNavigate}
        />}
      </nav>
    </div>
  )
}

function useSearch(query: string) {
  const [result, setResult] = useState<{ query: string; data?: Awaited<ReturnType<typeof searchContent>>; failed?: boolean }>()
  const [revision, setRevision] = useState(0)
  useEffect(() => onChange((event) => {
    if (event === null || event.type === 'session') setRevision((value) => value + 1)
  }), [])
  useEffect(() => {
    if (!query) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      searchContent(query)
        .then((data) => !cancelled && setResult({ query, data }))
        .catch(() => !cancelled && setResult({ query, failed: true }))
    }, searchDelay)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [query, revision])
  return result?.query === query ? result : { query }
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

// 标题下面一行：编号、不是默认的 agent、轮数、大约占周额度多少、开着的 PR、排队的消息、停止或出错；最右边是在回答、在等后台任务，或者最后有动静的时间
function SessionMeta({ session, clock }: { session: SessionSummary; clock: boolean }) {
  const openPrs = session.prs.filter((pr) => pr.state === 'open')
  const date = new Date(session.updatedAt)
  return (
    <span className={styles.meta}>
      <span>#{session.id}</span>
      {session.agent !== defaultAgent && <span>{agents[session.agent].name}</span>}
      {session.turns > 1 && <span>{session.turns} 轮</span>}
      {session.quota !== undefined && session.quota >= 0.005 && (
        <span title="大约占订阅周额度">
          <Gauge size={12} strokeWidth={2} />
          {formatQuota(session.quota)}
        </span>
      )}
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

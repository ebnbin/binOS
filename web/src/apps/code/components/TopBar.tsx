import type { PullRequest, SessionSummary } from '@binos/server/apps/code/types'
import { ChevronDown, ChevronLeft, GitMerge, GitPullRequest, GitPullRequestClosed, SquarePen } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { formatTokens } from '../format.ts'
import { Menu, RenameInput, SessionMenuItems } from './SessionMenu.tsx'
import styles from './TopBar.module.css'
import { IconButton } from '../../../ui/IconButton.tsx'

// 一列时左边返回列表、右边新对话；两列时列表就在旁边，只显示标题。session：列表里这个 session 的概况，还没读到时没有
export function TopBar({
  title,
  sessionId,
  session,
  onBack,
  onNew,
}: {
  title: string
  sessionId: number | null
  session: SessionSummary | undefined
  onBack: () => void
  onNew: () => void
}) {
  const prs = session?.prs ?? []
  const context = session?.context
  return (
    <header className={styles.bar}>
      <IconButton icon={ChevronLeft} label="返回对话列表" className={styles.singleColumnOnly} onClick={onBack} />
      <div className={styles.heading}>
        {sessionId === null ? (
          <span className={`${styles.title} ${styles.singleColumnOnly}`}>新对话</span>
        ) : (
          <>
            {session ? <SessionTitle key={session.id} session={session} /> : <span className={styles.title}>{title}</span>}
            <span className={styles.id}>#{sessionId}</span>
            {prs.length > 0 && <PrList prs={prs} />}
            {context && (
              <span className={styles.context} title={`上下文 ${formatTokens(context.tokens)} / ${formatTokens(context.window)} token`}>
                上下文 {Math.round((context.tokens / context.window) * 100)}%
              </span>
            )}
          </>
        )}
      </div>
      <IconButton
        icon={SquarePen}
        label="新对话"
        className={styles.singleColumnOnly}
        onClick={onNew}
        disabled={sessionId === null}
      />
    </header>
  )
}

// 点标题打开这个会话的操作菜单，重命名时标题换成输入框
function SessionTitle({ session }: { session: SessionSummary }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  if (renaming) {
    return <RenameInput session={session} className={styles.rename} onDone={() => setRenaming(false)} />
  }
  return (
    <span className={styles.titleWrap}>
      <button type="button" className={styles.titleButton} onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-haspopup="menu">
        <span className={styles.title}>{session.title || '（无内容）'}</span>
        <ChevronDown size={14} strokeWidth={2} className={styles.titleChevron} />
      </button>
      {menuOpen && (
        <Menu className={styles.titleMenu} onClose={() => setMenuOpen(false)}>
          <SessionMenuItems session={session} onRename={() => setRenaming(true)} />
        </Menu>
      )}
    </span>
  )
}

// 开着的 PR 直接显示，结束了的收起来，点开再看
function PrList({ prs }: { prs: PullRequest[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) {
      return
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])
  const active = prs.filter((pr) => pr.state === 'open' || !pr.state)
  const finished = prs.filter((pr) => pr.state === 'merged' || pr.state === 'closed')
  return (
    <span ref={ref} className={styles.prs}>
      {active.map((pr) => (
        <PrLink key={pr.url} pr={pr} />
      ))}
      {finished.length > 0 && (
        <button type="button" className={styles.finished} onClick={() => setOpen(!open)} aria-expanded={open}>
          <GitMerge size={13} strokeWidth={2} />
          {finished.length}
        </button>
      )}
      {open && (
        <span className={styles.prMenu}>
          {[...prs].reverse().map((pr) => (
            <a key={pr.url} href={pr.url} target="_blank" rel="noreferrer" data-state={pr.state}>
              <span className={styles.prNumber}>#{pr.number}</span>
              <span className={styles.prTitle}>{pr.title ?? pr.url}</span>
              <span className={styles.prState}>{pr.state && prStates[pr.state]}</span>
            </a>
          ))}
        </span>
      )}
    </span>
  )
}

const prIcons = { open: GitPullRequest, merged: GitMerge, closed: GitPullRequestClosed }
const prStates = { open: '开着', merged: '已合并', closed: '已关闭' }

// 这个 session 开的 PR：点编号去 GitHub，开着的有预览时另有预览链接
function PrLink({ pr }: { pr: PullRequest }) {
  const Icon = prIcons[pr.state ?? 'open']
  return (
    <span className={styles.pr} data-state={pr.state}>
      <a href={pr.url} target="_blank" rel="noreferrer" title={[pr.title, pr.state && prStates[pr.state]].filter(Boolean).join(' · ')}>
        <Icon size={13} strokeWidth={2} />#{pr.number}
      </a>
      {pr.preview && (
        <a href={pr.preview} target="_blank" rel="noreferrer" className={styles.preview}>
          预览
        </a>
      )}
    </span>
  )
}

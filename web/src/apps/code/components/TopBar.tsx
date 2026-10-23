import type { PullRequest, SessionSummary } from '@binos/server/apps/code/types'
import { ChevronLeftIcon, GitMergeIcon, GitPullRequestClosedIcon, GitPullRequestIcon, PencilIcon, TriangleDownIcon } from '@primer/octicons-react'
import { useState } from 'react'
import { RenameInput, SessionActions } from './SessionMenu.tsx'
import { Button } from '../../../ui/Button.tsx'
import { IconButton } from '../../../ui/IconButton.tsx'
import { CounterLabel, StateLabel } from '../../../ui/Label.tsx'
import { Popover } from '../../../ui/Popover.tsx'
import list from '../../../ui/ActionList.module.css'
import styles from './TopBar.module.css'
// 一列时左边返回列表、右边新对话；两列时列表就在旁边，只显示标题，上下文的用量在输入框里。session：列表里这个 session 的概况，还没读到时没有。
// 点空白处回到对话顶部，和 iOS 点状态栏一样
export function TopBar({
  title,
  sessionId,
  session,
  onBack,
  onNew,
  onScrollTop,
}: {
  title: string
  sessionId: number | null
  session: SessionSummary | undefined
  onBack: () => void
  onNew: () => void
  onScrollTop: () => void
}) {
  const prs = session?.prs ?? []
  return (
    <header className={styles.bar} onClick={(event) => event.target === event.currentTarget && onScrollTop()}>
      <IconButton icon={ChevronLeftIcon} label="返回对话列表" className={styles.singleColumnOnly} onClick={onBack} />
      <div className={styles.heading} onClick={(event) => event.target === event.currentTarget && onScrollTop()}>
        {sessionId === null ? (
          <span className={`${styles.title} ${styles.singleColumnOnly}`}>新对话</span>
        ) : (
          <>
            {session ? <SessionTitle key={session.id} session={session} /> : <span className={styles.title}>{title}</span>}
            <span className={styles.id}>#{sessionId}</span>
            {prs.length > 0 && <PrList prs={prs} />}
          </>
        )}
      </div>
      {sessionId !== null && <IconButton icon={PencilIcon} label="新对话" className={styles.singleColumnOnly} onClick={onNew} />}
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
      <SessionActions session={session} onRename={() => setRenaming(true)} open={menuOpen} onOpenChange={setMenuOpen}>
        <Button variant="invisible" className={styles.titleButton} trailingAction={TriangleDownIcon} aria-expanded={menuOpen} aria-haspopup="menu">
          {session.title || '（无内容）'}
        </Button>
      </SessionActions>
    </span>
  )
}

// 开着的 PR 直接显示，结束了的收起来，点开再看
function PrList({ prs }: { prs: PullRequest[] }) {
  const active = prs.filter((pr) => pr.state === 'open' || !pr.state)
  const finished = prs.filter((pr) => pr.state === 'merged' || pr.state === 'closed')
  return (
    <span className={styles.prs}>
      {active.map((pr) => (
        <PrLink key={pr.url} pr={pr} />
      ))}
      {finished.length > 0 && (
        <Popover
          label="对话的 PR"
          className={styles.prMenu}
          trigger={
            <Button variant="invisible" size="small" leadingVisual={GitMergeIcon} trailingVisual={<CounterLabel>{finished.length}</CounterLabel>} aria-label="查看对话的 PR" />
          }
        >
          <div className={list.list}>
            {[...prs].reverse().map((pr) => {
              const Icon = prIcons[pr.state ?? 'open']
              return (
                <a key={pr.url} href={pr.url} target="_blank" rel="noreferrer" className={`${list.item} ${styles.prItem}`} data-state={pr.state}>
                  <span className={`${list.visual} ${styles.prIcon}`}><Icon size={16} /></span>
                  <span className={list.content}>
                    <span className={list.label}>{pr.title ?? pr.url}</span>
                    <span className={list.description}>#{pr.number}{pr.state && ` · ${prStates[pr.state]}`}</span>
                  </span>
                </a>
              )
            })}
          </div>
        </Popover>
      )}
    </span>
  )
}

const prIcons = { open: GitPullRequestIcon, merged: GitMergeIcon, closed: GitPullRequestClosedIcon }
const prStates = { open: '开着', merged: '已合并', closed: '已关闭' }

// 这个 session 开的 PR：点编号去 GitHub，开着的有预览时另有预览链接
function PrLink({ pr }: { pr: PullRequest }) {
  const Icon = prIcons[pr.state ?? 'open']
  return (
    <span className={styles.pr}>
      <a href={pr.url} target="_blank" rel="noreferrer" className={styles.prLink} title={[pr.title, pr.state && prStates[pr.state]].filter(Boolean).join(' · ')}>
        <StateLabel status={pr.state ?? 'open'}>
          <Icon size={16} />#{pr.number}
        </StateLabel>
      </a>
      {pr.preview && (
        <a href={pr.preview} target="_blank" rel="noreferrer" className={styles.preview}>
          预览
        </a>
      )}
    </span>
  )
}

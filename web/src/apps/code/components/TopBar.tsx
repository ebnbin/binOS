import type { PullRequest, SessionSummary } from '@binos/server/apps/code/types'
import { Badge, Button, Text } from '@radix-ui/themes'
import { useState } from 'react'
import { RenameInput, SessionActions } from './SessionMenu.tsx'
import { Popover } from '../../../ui/Popover.tsx'
import styles from './TopBar.module.css'
import { IconButton } from '../../../ui/IconButton.tsx'
import { ChevronDownIcon, ChevronLeftIcon, GitMergeIcon, GitPullRequestClosedIcon, GitPullRequestIcon, Pencil2Icon } from '../../../ui/icons.ts'

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
          <Text size="2" weight="medium" className={`${styles.title} ${styles.singleColumnOnly}`}>
            新对话
          </Text>
        ) : (
          <>
            {session ? (
              <SessionTitle key={session.id} session={session} />
            ) : (
              <Text size="2" weight="medium" className={styles.title}>
                {title}
              </Text>
            )}
            <Text size="1" color="gray" className={styles.id}>
              #{sessionId}
            </Text>
            {prs.length > 0 && <PrList prs={prs} />}
          </>
        )}
      </div>
      {sessionId !== null && <IconButton icon={Pencil2Icon} label="新对话" className={styles.singleColumnOnly} onClick={onNew} />}
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
    <SessionActions session={session} onRename={() => setRenaming(true)} open={menuOpen} onOpenChange={setMenuOpen}>
      <Button type="button" size="2" variant="ghost" color="gray" highContrast className={styles.titleButton} aria-expanded={menuOpen} aria-haspopup="menu">
        <span className={styles.title}>{session.title || '（无内容）'}</span>
        <ChevronDownIcon className={styles.titleChevron} />
      </Button>
    </SessionActions>
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
          size="1"
          className={styles.prMenu}
          trigger={
            <Badge asChild size="1" variant="soft" color="gray" className={styles.badge}>
              <button type="button" aria-label="查看对话的 PR">
                <GitMergeIcon width={12} height={12} />
                {finished.length}
              </button>
            </Badge>
          }
        >
          {[...prs].reverse().map((pr) => (
            <a key={pr.url} href={pr.url} target="_blank" rel="noreferrer" className={styles.prItem}>
              <span className={styles.prNumber}>#{pr.number}</span>
              <span className={styles.prTitle}>{pr.title ?? pr.url}</span>
              {pr.state && (
                <Badge size="1" variant="soft" color={prColors[pr.state]}>
                  {prStates[pr.state]}
                </Badge>
              )}
            </a>
          ))}
        </Popover>
      )}
    </span>
  )
}

const prIcons = { open: GitPullRequestIcon, merged: GitMergeIcon, closed: GitPullRequestClosedIcon }
const prStates = { open: '开着', merged: '已合并', closed: '已关闭' }
// GitHub 的配色：开着绿、合并紫、关闭红
const prColors = { open: 'green', merged: 'violet', closed: 'red' } as const

// 这个 session 开的 PR：点编号去 GitHub，开着的有预览时另有预览链接
function PrLink({ pr }: { pr: PullRequest }) {
  const Icon = prIcons[pr.state ?? 'open']
  return (
    <span className={styles.pr}>
      <Badge asChild size="1" variant="soft" color={prColors[pr.state ?? 'open']} className={styles.badge}>
        <a href={pr.url} target="_blank" rel="noreferrer" title={[pr.title, pr.state && prStates[pr.state]].filter(Boolean).join(' · ')}>
          <Icon width={12} height={12} />#{pr.number}
        </a>
      </Badge>
      {pr.preview && (
        <Badge asChild size="1" variant="soft" color="gray" className={styles.badge}>
          <a href={pr.preview} target="_blank" rel="noreferrer">
            预览
          </a>
        </Badge>
      )}
    </span>
  )
}

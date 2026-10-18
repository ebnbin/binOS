import type { Context } from '@binos/server/apps/agent/types'
import { ChevronLeft, SquarePen } from 'lucide-react'
import { formatTokens } from '../format.ts'
import styles from './TopBar.module.css'
import { IconButton } from '../../../ui/IconButton.tsx'

// 一列时左边返回列表、右边新对话；两列时列表就在旁边，只显示标题。context：最近一轮结束时的上下文占用
export function TopBar({
  title,
  sessionId,
  context,
  onBack,
  onNew,
}: {
  title: string
  sessionId: number | null
  context: Context | undefined
  onBack: () => void
  onNew: () => void
}) {
  return (
    <header className={styles.bar}>
      <IconButton icon={ChevronLeft} label="返回对话列表" className={styles.singleColumnOnly} onClick={onBack} />
      <div className={styles.heading}>
        {sessionId === null ? (
          <span className={`${styles.title} ${styles.singleColumnOnly}`}>新对话</span>
        ) : (
          <>
            <span className={styles.title}>{title}</span>
            <span className={styles.id}>#{sessionId}</span>
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

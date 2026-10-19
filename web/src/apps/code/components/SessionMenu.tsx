import type { SessionSummary } from '@binos/server/apps/code/types'
import { Archive, ArchiveRestore, Pencil, Pin, PinOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { editSession } from '../api.ts'
import styles from './SessionMenu.module.css'

// 会话的操作：重命名、置顶、归档。列表的每一项和对话的顶栏共用
export function SessionMenuItems({ session, onRename }: { session: SessionSummary; onRename: () => void }) {
  return (
    <>
      <button type="button" onClick={onRename}>
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
    </>
  )
}

// 回车或者失去焦点时改名，Esc 取消；没改就不提交
export function RenameInput({ session, className, onDone }: { session: SessionSummary; className?: string; onDone: () => void }) {
  const [value, setValue] = useState(session.title)
  const done = useRef(false)
  function finish(title: string | undefined) {
    if (done.current) {
      return
    }
    done.current = true
    if (title && title !== session.title) {
      void editSession(session.id, { title })
    }
    onDone()
  }
  return (
    <input
      className={`${styles.rename} ${className ?? ''}`}
      value={value}
      autoFocus
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => finish(value.trim() || undefined)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
          event.currentTarget.blur()
        } else if (event.key === 'Escape') {
          finish(undefined)
        }
      }}
      aria-label="新的名字"
    />
  )
}

// 弹出菜单，相对于最近的定位的父元素。点父元素外面、按 Esc、或者选了一项后关上
export function Menu({ className, onClose, children }: { className?: string; onClose: () => void; children: ReactNode }) {
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
    <div ref={ref} className={`${styles.menu} ${className ?? ''}`} role="menu" onClick={onClose}>
      {children}
    </div>
  )
}

import { Button, Input } from '../../../ui/Controls.tsx'
import type { SessionSummary } from '@binos/server/apps/code/types'
import { Popover } from '../../../ui/Popover.tsx'
import { Archive, ArchiveRestore, Pencil, Pin, PinOff } from 'lucide-react'
import { useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { editSession } from '../api.ts'
import styles from './SessionMenu.module.css'

export function SessionActions({
  session,
  onRename,
  children,
  open,
  onOpenChange,
}: {
  session: SessionSummary
  onRename: () => void
  children: ReactElement
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function edit(change: { pinned?: boolean; archived?: boolean }) {
    setSaving(true)
    setError('')
    try {
      if (await editSession(session.id, change)) onOpenChange(false)
      else setError('保存失败，请重试')
    } catch {
      setError('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }
  return (
    <Popover
      trigger={children}
      label="会话操作"
      role="menu"
      open={open}
      onOpenChange={(next) => {
        setError('')
        onOpenChange(next)
      }}
      className={styles.menu}
    >
      <Button
        type="button"
        role="menuitem"
        className={styles.menuItem}
        disabled={saving}
        onClick={() => {
          onOpenChange(false)
          onRename()
        }}
      >
        <Pencil size={16} />
        重命名
      </Button>
      <Button
        type="button"
        role="menuitem"
        className={styles.menuItem}
        disabled={saving}
        onClick={() => void edit({ pinned: !session.pinned })}
      >
        {session.pinned ? <PinOff size={16} /> : <Pin size={16} />}
        {session.pinned ? '取消置顶' : '置顶'}
      </Button>
      <Button
        type="button"
        role="menuitem"
        className={styles.menuItem}
        disabled={saving}
        onClick={() => void edit({ archived: !session.archived })}
      >
        {session.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
        {session.archived ? '取消归档' : '归档'}
      </Button>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </Popover>
  )
}

export function RenameInput({ session, className, onDone }: { session: SessionSummary; className?: string; onDone: () => void }) {
  const [value, setValue] = useState(session.title)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const done = useRef(false)
  async function finish(title: string | undefined) {
    if (done.current) return
    done.current = true
    if (!title || title === session.title) {
      onDone()
      return
    }
    setSaving(true)
    try {
      if (await editSession(session.id, { title })) onDone()
      else {
        done.current = false
        setError('保存失败，请重试')
      }
    } catch {
      done.current = false
      setError('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }
  return (
    <span className={`${styles.renameWrap} ${className ?? ''}`}>
      <Input
        className={styles.rename}
        value={value}
        autoFocus
        readOnly={saving}
        aria-invalid={Boolean(error)}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => {
          setValue(event.target.value)
          setError('')
        }}
        onBlur={() => void finish(value.trim() || undefined)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            event.preventDefault()
            void finish(value.trim() || undefined)
          } else if (event.key === 'Escape' && !saving) {
            done.current = true
            onDone()
          }
        }}
        aria-label="新的名字"
      />
      {error && (
        <span className={styles.error} role="alert">
          {error}
        </span>
      )}
    </span>
  )
}

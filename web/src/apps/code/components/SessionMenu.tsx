import type { SessionSummary } from '@binos/server/apps/code/types'
import { ArchiveRegular } from '@fluentui/react-icons/headless/svg/archive'
import { ArchiveArrowBackRegular } from '@fluentui/react-icons/headless/svg/archive-arrow-back'
import { PinRegular } from '@fluentui/react-icons/headless/svg/pin'
import { PinOffRegular } from '@fluentui/react-icons/headless/svg/pin-off'
import { RenameRegular } from '@fluentui/react-icons/headless/svg/rename'
import { useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { Input } from '../../../ui/Input.tsx'
import { Menu, MenuItem } from '../../../ui/Menu.tsx'
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
  const renaming = useRef(false)
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
    <Menu
      open={open}
      onOpenChange={(next) => {
        setError('')
        onOpenChange(next)
      }}
      modal={false}
      label="会话操作"
      trigger={children}
      onCloseAutoFocus={(event) => {
        if (renaming.current) event.preventDefault()
      }}
    >
      <MenuItem
        icon={<RenameRegular />}
        disabled={saving}
        onSelect={() => {
          renaming.current = true
          onOpenChange(false)
          onRename()
        }}
      >
        重命名
      </MenuItem>
      <MenuItem
        icon={session.pinned ? <PinOffRegular /> : <PinRegular />}
        disabled={saving}
        onSelect={(event) => {
          event.preventDefault()
          void edit({ pinned: !session.pinned })
        }}
      >
        {session.pinned ? '取消置顶' : '置顶'}
      </MenuItem>
      <MenuItem
        icon={session.archived ? <ArchiveArrowBackRegular /> : <ArchiveRegular />}
        disabled={saving}
        onSelect={(event) => {
          event.preventDefault()
          void edit({ archived: !session.archived })
        }}
      >
        {session.archived ? '取消归档' : '归档'}
      </MenuItem>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </Menu>
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

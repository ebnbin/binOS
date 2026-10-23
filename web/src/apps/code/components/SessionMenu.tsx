import type { SessionSummary } from '@binos/server/apps/code/types'
import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { AlertFillIcon, ArchiveIcon, PencilIcon, PinIcon, PinSlashIcon, UndoIcon } from '@primer/octicons-react'
import type { Icon } from '@primer/octicons-react'
import { useRef, useState } from 'react'
import type { ReactElement } from 'react'
import list from '../../../ui/ActionList.module.css'
import overlay from '../../../ui/Overlay.module.css'
import { TextInput } from '../../../ui/TextInput.tsx'
import { editSession } from '../api.ts'
import styles from './SessionMenu.module.css'

function ItemContent({ icon: Leading, children }: { icon: Icon; children: string }) {
  return (
    <>
      <span className={list.visual}><Leading size={16} /></span>
      <span className={list.label}>{children}</span>
    </>
  )
}

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
    <Dropdown.Root
      open={open}
      onOpenChange={(next) => {
        setError('')
        onOpenChange(next)
      }}
      modal={false}
    >
      <Dropdown.Trigger asChild>{children}</Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          className={`${overlay.overlay} ${list.list}`}
          align="end"
          sideOffset={4}
          collisionPadding={8}
          aria-label="会话操作"
          onCloseAutoFocus={(event) => {
            if (renaming.current) event.preventDefault()
          }}
        >
          <Dropdown.Item
            className={list.item}
            disabled={saving}
            onSelect={() => {
              renaming.current = true
              onOpenChange(false)
              onRename()
            }}
          >
            <ItemContent icon={PencilIcon}>重命名</ItemContent>
          </Dropdown.Item>
          <Dropdown.Item
            className={list.item}
            disabled={saving}
            onSelect={(event) => {
              event.preventDefault()
              void edit({ pinned: !session.pinned })
            }}
          >
            <ItemContent icon={session.pinned ? PinSlashIcon : PinIcon}>{session.pinned ? '取消置顶' : '置顶'}</ItemContent>
          </Dropdown.Item>
          <Dropdown.Item
            className={list.item}
            disabled={saving}
            onSelect={(event) => {
              event.preventDefault()
              void edit({ archived: !session.archived })
            }}
          >
            <ItemContent icon={session.archived ? UndoIcon : ArchiveIcon}>{session.archived ? '取消归档' : '归档'}</ItemContent>
          </Dropdown.Item>
          {error && (
            <p className={`${styles.error} ${styles.menuError}`} role="alert">
              <AlertFillIcon size={12} />
              {error}
            </p>
          )}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
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
      <TextInput
        block
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
          <AlertFillIcon size={12} />
          {error}
        </span>
      )}
    </span>
  )
}

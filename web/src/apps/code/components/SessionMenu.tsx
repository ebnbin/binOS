import type { SessionSummary } from '@binos/server/apps/code/types'
import { DropdownMenu, Text, TextField } from '@radix-ui/themes'
import { useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { ArchiveIcon, ArchiveRestoreIcon, DrawingPinIcon, Pencil1Icon, PinOffIcon } from '../../../ui/icons.ts'
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
    <DropdownMenu.Root
      open={open}
      onOpenChange={(next) => {
        setError('')
        onOpenChange(next)
      }}
      modal={false}
    >
      <DropdownMenu.Trigger>{children}</DropdownMenu.Trigger>
      <DropdownMenu.Content
        size="2"
        collisionPadding={12}
        aria-label="会话操作"
        onCloseAutoFocus={(event) => {
          if (renaming.current) event.preventDefault()
        }}
      >
        <DropdownMenu.Item
          disabled={saving}
          onSelect={() => {
            renaming.current = true
            onOpenChange(false)
            onRename()
          }}
        >
          <Pencil1Icon />
          重命名
        </DropdownMenu.Item>
        <DropdownMenu.Item
          disabled={saving}
          onSelect={(event) => {
            event.preventDefault()
            void edit({ pinned: !session.pinned })
          }}
        >
          {session.pinned ? <PinOffIcon /> : <DrawingPinIcon />}
          {session.pinned ? '取消置顶' : '置顶'}
        </DropdownMenu.Item>
        <DropdownMenu.Item
          disabled={saving}
          onSelect={(event) => {
            event.preventDefault()
            void edit({ archived: !session.archived })
          }}
        >
          {session.archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
          {session.archived ? '取消归档' : '归档'}
        </DropdownMenu.Item>
        {error && (
          <Text as="p" size="1" color="red" role="alert" className={styles.error}>
            {error}
          </Text>
        )}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
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
      <TextField.Root
        size="2"
        color={error ? 'red' : undefined}
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
        <Text size="1" color="red" role="alert">
          {error}
        </Text>
      )}
    </span>
  )
}

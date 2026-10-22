import { Field } from '../../../ui/Field.tsx'
import { Menu, MenuItem, MenuTrigger, Text } from '@react-spectrum/s2'
import type { SessionSummary } from '@binos/server/apps/code/types'
import { Archive, ArchiveRestore, Pencil, Pin, PinOff } from '../../../ui/icons.tsx'
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
    <>
      <MenuTrigger
        isOpen={open}
        onOpenChange={(next) => {
          setError('')
          onOpenChange(next)
        }}
        align="end"
      >
        {children}
        <Menu
          aria-label="会话操作"
          disabledKeys={saving ? ['rename', 'pin', 'archive'] : []}
          onAction={(key) => {
            if (key === 'rename') {
              onOpenChange(false)
              requestAnimationFrame(onRename)
            } else if (key === 'pin') void edit({ pinned: !session.pinned })
            else if (key === 'archive') void edit({ archived: !session.archived })
          }}
        >
          <MenuItem id="rename">
            <Pencil />
            <Text>重命名</Text>
          </MenuItem>
          <MenuItem id="pin" shouldCloseOnSelect={false}>
            {session.pinned ? <PinOff /> : <Pin />}
            <Text>{session.pinned ? '取消置顶' : '置顶'}</Text>
          </MenuItem>
          <MenuItem id="archive" shouldCloseOnSelect={false}>
            {session.archived ? <ArchiveRestore /> : <Archive />}
            <Text>{session.archived ? '取消归档' : '归档'}</Text>
          </MenuItem>
          {error && (
            <MenuItem id="error" isDisabled textValue={error}>
              <Text>
                <span className={styles.error} role="alert">
                  {error}
                </span>
              </Text>
            </MenuItem>
          )}
        </Menu>
      </MenuTrigger>
    </>
  )
}

export function RenameInput({
  session,
  className,
  onDone,
}: {
  session: SessionSummary
  className?: string
  onDone: () => void
}) {
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
      <Field
        className={styles.rename}
        value={value}
        autoFocus
        readOnly={saving}
        aria-invalid={Boolean(error)}
        onFocus={(event) => event.currentTarget.select()}
        onValueChange={(value) => {
          setValue(value)
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

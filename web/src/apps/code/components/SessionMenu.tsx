import { Input } from '../../../ui/Input.tsx'
import type { SessionSummary } from '@binos/server/apps/code/types'
import { Alert, ListItemIcon, Menu, MenuItem } from '@mui/material'
import { Archive, ArchiveRestore, Pencil, Pin, PinOff } from '../../../ui/icons.tsx'
import { cloneElement, useRef, useState } from 'react'
import type { MouseEventHandler, ReactElement } from 'react'
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
  const [renaming, setRenaming] = useState(false)
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
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
  const trigger = children as ReactElement<{ onClick?: MouseEventHandler<HTMLElement> }>
  return (
    <>
      {cloneElement(trigger, {
        onClick: (event) => {
          trigger.props.onClick?.(event)
          setRenaming(false)
          setError('')
          setAnchor(event.currentTarget)
          onOpenChange(true)
        },
      })}
      <Menu
        anchorEl={anchor}
        open={open}
        onClose={() => onOpenChange(false)}
        disableRestoreFocus={renaming}
        slotProps={{
          list: { 'aria-label': '会话操作' },
          transition: {
            onExited: () => {
              if (renaming) {
                setRenaming(false)
                onRename()
              }
            },
          },
        }}
      >
        <MenuItem
          disabled={saving}
          onClick={() => {
            setRenaming(true)
            onOpenChange(false)
          }}
        >
          <ListItemIcon>
            <Pencil size={20} />
          </ListItemIcon>
          重命名
        </MenuItem>
        <MenuItem disabled={saving} onClick={() => void edit({ pinned: !session.pinned })}>
          <ListItemIcon>{session.pinned ? <PinOff size={20} /> : <Pin size={20} />}</ListItemIcon>
          {session.pinned ? '取消置顶' : '置顶'}
        </MenuItem>
        <MenuItem disabled={saving} onClick={() => void edit({ archived: !session.archived })}>
          <ListItemIcon>{session.archived ? <ArchiveRestore size={20} /> : <Archive size={20} />}</ListItemIcon>
          {session.archived ? '取消归档' : '归档'}
        </MenuItem>
        {error && <Alert severity="error">{error}</Alert>}
      </Menu>
    </>
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

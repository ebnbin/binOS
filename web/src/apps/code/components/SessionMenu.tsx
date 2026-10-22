import { useReducedMotion } from '../../../ui/useReducedMotion.ts'
import { Input } from '../../../ui/Input.tsx'
import '@material/web/menu/menu.js'
import '@material/web/menu/menu-item.js'
import type { MdMenu } from '@material/web/menu/menu.js'
import type { SessionSummary } from '@binos/server/apps/code/types'
import { cloneElement, useLayoutEffect, useRef, useState } from 'react'
import type { ReactElement, HTMLAttributes, Ref } from 'react'
import { Archive, ArchiveRestore, Pencil, Pin, PinOff } from '../../../ui/icons.tsx'
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
  const quick = useReducedMotion()
  const anchor = useRef<HTMLElement>(null)
  const menu = useRef<MdMenu>(null)
  const renaming = useRef(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useLayoutEffect(() => {
    if (menu.current) menu.current.anchorElement = anchor.current
  })
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
  const original = children.props as HTMLAttributes<HTMLElement>
  return (
    <>
      {cloneElement(children as ReactElement<HTMLAttributes<HTMLElement> & { ref?: Ref<HTMLElement> }>, {
        ref: anchor,
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        onClick: (event) => {
          original.onClick?.(event)
          if (event.defaultPrevented) return
          setError('')
          const next = !menu.current?.open
          if (menu.current) menu.current.open = next
          onOpenChange(next)
        },
        onKeyDown: (event) => {
          original.onKeyDown?.(event)
          if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return
          event.preventDefault()
          if (menu.current) {
            menu.current.defaultFocus = event.key === 'ArrowUp' ? 'last-item' : 'first-item'
            menu.current.open = true
          }
          onOpenChange(true)
        },
      })}
      <md-menu
        quick={quick}
        role="menu"
        ref={menu}
        open={open}
        positioning="popover"
        aria-label="会话操作"
        className={styles.menu}
        anchorCorner="end-end"
        menuCorner="start-end"
        yOffset={8}
        onclosing={() => {
          if (!menu.current?.open) onOpenChange(false)
        }}
        onclosed={() => {
          if (renaming.current) {
            renaming.current = false
            onRename()
            if (menu.current) menu.current.skipRestoreFocus = false
          }
        }}
      >
        <md-menu-item
          keepOpen
          disabled={saving}
          onClick={() => {
            renaming.current = true
            if (menu.current) menu.current.skipRestoreFocus = true
            onOpenChange(false)
          }}
        >
          <Pencil slot="start" size={24} />
          <div slot="headline">重命名</div>
        </md-menu-item>
        <md-menu-item keepOpen disabled={saving} onClick={() => void edit({ pinned: !session.pinned })}>
          {session.pinned ? <PinOff slot="start" /> : <Pin slot="start" />}
          <div slot="headline">{session.pinned ? '取消置顶' : '置顶'}</div>
        </md-menu-item>
        <md-menu-item keepOpen disabled={saving} onClick={() => void edit({ archived: !session.archived })}>
          {session.archived ? <ArchiveRestore slot="start" /> : <Archive slot="start" />}
          <div slot="headline">{session.archived ? '取消归档' : '归档'}</div>
        </md-menu-item>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
      </md-menu>
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

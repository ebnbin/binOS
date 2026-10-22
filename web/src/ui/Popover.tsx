import { cloneElement, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactElement, ReactNode, Ref } from 'react'
import { createPortal } from 'react-dom'
import styles from './Popover.module.css'
import { placePopover } from './floating.ts'

type TriggerProps = {
  ref?: Ref<HTMLElement>
  onClick?: (event: React.MouseEvent) => void
  onKeyDown?: (event: React.KeyboardEvent) => void
  'aria-expanded'?: boolean
  'aria-controls'?: string
  'aria-haspopup'?: 'dialog' | 'menu'
}

export function Popover({
  trigger,
  label,
  children,
  open: controlled,
  onOpenChange,
  className,
  side = 'bottom',
  align = 'end',
  role = 'dialog',
  restoreFocus = true,
}: {
  trigger: ReactElement
  label: string
  children: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
  side?: 'top' | 'bottom'
  align?: 'start' | 'end'
  role?: 'dialog' | 'menu'
  restoreFocus?: boolean
}) {
  const [local, setLocal] = useState(false)
  const open = controlled ?? local
  const anchor = useRef<HTMLElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const initialFocus = useRef<'first' | 'last'>('first')
  const id = useId()
  const [position, setPosition] = useState<CSSProperties>({ visibility: 'hidden' })
  const change = (next: boolean) => {
    setLocal(next)
    onOpenChange?.(next)
  }
  const latest = useRef({ change, restoreFocus })
  useLayoutEffect(() => {
    latest.current = { change, restoreFocus }
  })
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const a = anchor.current?.getBoundingClientRect()
      const p = panel.current?.getBoundingClientRect()
      if (!a || !p) return
      setPosition({ ...placePopover(a, p, { width: window.innerWidth, height: window.innerHeight }, side, align), visibility: 'visible' })
    }
    place()
    const observer = new ResizeObserver(place)
    if (panel.current) observer.observe(panel.current)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    const frame = requestAnimationFrame(() => {
      const element = panel.current
      const items = element?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, select, textarea, [tabindex="0"]')
      const target = items?.[initialFocus.current === 'last' ? items.length - 1 : 0] ?? element
      target?.focus({ preventScroll: true })
    })
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, side, align])
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !panel.current?.contains(event.target) && !anchor.current?.contains(event.target))
        latest.current.change(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      latest.current.change(false)
      if (latest.current.restoreFocus) anchor.current?.focus()
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape, true)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape, true)
    }
  }, [open])
  const original = trigger.props as TriggerProps
  return (
    <>
      {cloneElement(trigger as ReactElement<TriggerProps>, {
        ref: anchor,
        'aria-expanded': open,
        'aria-controls': open ? id : undefined,
        'aria-haspopup': role,
        onClick: (event) => {
          initialFocus.current = 'first'
          original.onClick?.(event)
          if (!event.defaultPrevented) change(!open)
        },
        onKeyDown: (event) => {
          original.onKeyDown?.(event)
          if (event.defaultPrevented || role !== 'menu' || !['ArrowDown', 'ArrowUp'].includes(event.key)) return
          event.preventDefault()
          initialFocus.current = event.key === 'ArrowUp' ? 'last' : 'first'
          change(true)
        },
      })}
      {open &&
        createPortal(
          <div
            ref={panel}
            id={id}
            role={role}
            aria-label={label}
            tabIndex={-1}
            className={`${styles.content} ${className ?? ''}`}
            style={position}
            onBlur={(event) => {
              if (
                event.relatedTarget instanceof Node &&
                !event.currentTarget.contains(event.relatedTarget) &&
                !anchor.current?.contains(event.relatedTarget)
              )
                change(false)
            }}
            onKeyDown={(event) => {
              if (role !== 'menu' || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
              const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)')]
              if (!items.length) return
              event.preventDefault()
              const index = items.indexOf(document.activeElement as HTMLElement)
              items[
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? items.length - 1
                    : (index + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length
              ]?.focus()
            }}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  )
}

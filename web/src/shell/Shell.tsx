import { useCallback, useEffect, useState } from 'react'
import { findApp } from '../apps/index.ts'
import { useStateList, useStateLoaded, useStateValue } from '../state.ts'
import type { HistoryState } from './AppHost.tsx'
import { ConnectionStatus } from './ConnectionStatus.tsx'
import { Desktop } from './Desktop.tsx'
import { formFor, normalizeFocus } from './layout.ts'
import type { Focus } from './layout.ts'
import { Mobile } from './Mobile.tsx'
import styles from './Shell.module.css'
import { focusKey, focusWindow, setRoute, windowPrefix } from './windows.ts'
import type { WindowState } from './windows.ts'

export type OpenWindow = { id: string; window: WindowState; title: string }

function useViewportSize() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight })
  useEffect(() => {
    const update = () => setSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return size
}

export function Shell() {
  const loaded = useStateLoaded()
  const size = useViewportSize()
  const form = formFor(size.width, size.height)
  const entries = useStateList(windowPrefix)
  const storedFocus = useStateValue(focusKey(form)) as Focus | null
  const [titles, setTitles] = useState<Record<string, string>>({})
  const onTitle = useCallback((id: string, title: string) => setTitles((prev) => (prev[id] === title ? prev : { ...prev, [id]: title })), [])

  const windows: OpenWindow[] = entries.map(([key, value]) => {
    const id = key.slice(windowPrefix.length)
    const win = value as WindowState
    const appName = findApp(win.app)?.name ?? win.app
    return { id, window: win, title: titles[id] ? `${appName} · ${titles[id]}` : appName }
  })
  const focus = normalizeFocus(storedFocus, windows.map((item) => item.id))

  useEffect(() => {
    const onPopState = () => {
      const state = window.history.state as HistoryState
      if (state) {
        setRoute(state.window, state.route)
        focusWindow(state.window, form)
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [form])

  return (
    <div className={styles.shell}>
      {loaded &&
        (form === 'desktop' ? (
          <Desktop windows={windows} focus={focus} size={size} onTitle={onTitle} />
        ) : (
          <Mobile windows={windows} focus={focus} onTitle={onTitle} />
        ))}
      <ConnectionStatus />
    </div>
  )
}

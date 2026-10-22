import { Theme } from '@radix-ui/themes'
import { useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import '@radix-ui/themes/styles.css'

const media = window.matchMedia('(prefers-color-scheme: dark)')
const subscribe = (change: () => void) => {
  media.addEventListener('change', change)
  return () => media.removeEventListener('change', change)
}

export function AppTheme({ children }: { children: ReactNode }) {
  const dark = useSyncExternalStore(subscribe, () => media.matches)
  const theme = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const root = document.documentElement
    root.style.colorScheme = dark ? 'dark' : 'light'
    root.style.backgroundColor = getComputedStyle(theme.current!).getPropertyValue('--gray-1')
  }, [dark])
  return (
    <Theme
      ref={theme}
      appearance={dark ? 'dark' : 'light'}
      accentColor="indigo"
      grayColor="slate"
      radius="medium"
      scaling="100%"
      panelBackground="solid"
      className="app-theme"
    >
      {children}
    </Theme>
  )
}

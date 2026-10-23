import { Theme } from '@radix-ui/themes'
import { useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'

const dark = window.matchMedia('(prefers-color-scheme: dark)')

function useAppearance() {
  return useSyncExternalStore(
    (onChange) => {
      dark.addEventListener('change', onChange)
      return () => dark.removeEventListener('change', onChange)
    },
    () => (dark.matches ? 'dark' : 'light'),
  )
}

// binOS 的 Radix Themes 主题，深浅色跟随系统
export function SystemTheme({ children }: { children: ReactNode }) {
  return (
    <Theme appearance={useAppearance()} accentColor="indigo" grayColor="slate" radius="medium" scaling="100%" panelBackground="solid" hasBackground={false}>
      {children}
    </Theme>
  )
}

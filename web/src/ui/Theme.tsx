import { FluentProvider, webDarkTheme } from '@fluentui/react-components'
import type { ReactNode } from 'react'
import { useTheme } from './useTheme.ts'

export function Theme({ children }: { children: ReactNode }) {
  const theme = useTheme()
  return (
    <FluentProvider theme={theme} className="binos-theme" style={{ colorScheme: theme === webDarkTheme ? 'dark' : 'light' }}>
      {children}
    </FluentProvider>
  )
}

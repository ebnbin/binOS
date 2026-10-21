import { CssBaseline, StyledEngineProvider, ThemeProvider, useMediaQuery } from '@mui/material'
import type { ReactNode } from 'react'
import { materialDark, materialLight } from './material.ts'

export function Theme({ children }: { children: ReactNode }) {
  const dark = useMediaQuery('(prefers-color-scheme: dark)')
  return (
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={(dark ? materialDark : materialLight).theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </StyledEngineProvider>
  )
}

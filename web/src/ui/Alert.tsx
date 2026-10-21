import { Alert as MaterialAlert } from '@mui/material'
import type { ReactNode } from 'react'

export function Alert({ children }: { children: ReactNode }) {
  return <MaterialAlert severity="error">{children}</MaterialAlert>
}

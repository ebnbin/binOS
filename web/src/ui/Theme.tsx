import { useLayoutEffect } from 'react'
import type { ReactNode } from 'react'
import { materialDark, materialLight } from './material.ts'

export function Theme({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      for (const [name, value] of Object.entries((media.matches ? materialDark : materialLight).variables))
        document.documentElement.style.setProperty(name, value)
      document.documentElement.style.colorScheme = media.matches ? 'dark' : 'light'
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [])
  return children
}

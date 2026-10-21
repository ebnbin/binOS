import { webDarkTheme, webLightTheme } from '@fluentui/react-components'
import { useSyncExternalStore } from 'react'

const preference = window.matchMedia('(prefers-color-scheme: dark)')
const subscribe = (update: () => void) => {
  preference.addEventListener('change', update)
  return () => preference.removeEventListener('change', update)
}

export function useTheme() {
  const dark = useSyncExternalStore(subscribe, () => preference.matches)
  return dark ? webDarkTheme : webLightTheme
}

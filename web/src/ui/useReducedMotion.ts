import { useSyncExternalStore } from 'react'

function subscribe(notify: () => void) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  media.addEventListener('change', notify)
  return () => media.removeEventListener('change', notify)
}

export function useReducedMotion() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  )
}

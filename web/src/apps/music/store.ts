import { useSyncExternalStore } from 'react'
import { music, queueSync } from './service.ts'

export { music, queueSync }
export function useQueueSync() { return useSyncExternalStore(queueSync.subscribe, queueSync.getSnapshot) }
export function useMusic() { return useSyncExternalStore(music.subscribe, music.getSnapshot) }

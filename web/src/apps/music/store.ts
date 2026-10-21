import { onChange } from '../../events.ts'
import { mutateQueue, readQueue } from './api.ts'
import { QueueSync } from './queueSync.ts'
import { useSyncExternalStore } from 'react'
import { MusicController, trackKey } from './controller.ts'
import { musicProviders } from './providers.ts'

export { musicProviders }
const storageKey = 'binos:music:v1'
let saved: unknown
try { saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null') } catch { /* Storage may be unavailable. */ }

// 生命周期属于当前浏览器页面，不随窗口或桌面 widget 的卸载结束。
export const music = new MusicController(musicProviders, saved, (state) => {
  try { localStorage.setItem(storageKey, JSON.stringify({ queue: state.queue, index: state.index, volume: state.volume, repeat: state.repeat })) } catch { /* Playback also works without storage. */ }
}, (operation) => queueSync.enqueue(operation))

export const queueSync = new QueueSync({ read: readQueue, mutate: mutateQueue }, tracks => music.replaceQueue(tracks))
queueSync.enqueue({ type: 'initialize', tracks: music.getSnapshot().queue })
const unsubscribeQueue = onChange(event => { if (!event || event.type === 'music') void queueSync.refresh() })
export function useQueueSync() { return useSyncExternalStore(queueSync.subscribe, queueSync.getSnapshot) }

export function useMusic() { return useSyncExternalStore(music.subscribe, music.getSnapshot) }

if (import.meta.hot) import.meta.hot.dispose(() => { unsubscribeQueue(); queueSync.close(); music.stop() })

if ('mediaSession' in navigator) {
  const actions: [MediaSessionAction, MediaSessionActionHandler][] = [
    ['play', () => music.play()],
    ['pause', () => music.pause()], ['previoustrack', () => music.previous()], ['nexttrack', () => music.next()],
    ['seekto', (details) => { if (details.seekTime !== undefined) music.seek(details.seekTime * 1000) }],
  ]
  for (const [action, handler] of actions) {
    try { navigator.mediaSession.setActionHandler(action, handler) } catch { /* Not all browsers support every action. */ }
  }
  let previousTrack = ''
  music.subscribe(() => {
    const state = music.getSnapshot()
    const track = state.queue[state.index]
    const key = track ? trackKey(track) : ''
    if (key !== previousTrack) {
      previousTrack = key
      navigator.mediaSession.metadata = track && typeof MediaMetadata !== 'undefined' ? new MediaMetadata({ title: track.title, artist: track.artists.join(' / '), artwork: track.artworkUrl ? [{ src: track.artworkUrl }] : [] }) : null
    }
    navigator.mediaSession.playbackState = state.status === 'playing' ? 'playing' : track ? 'paused' : 'none'
  })
}

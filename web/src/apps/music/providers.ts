import type { CatalogPage } from '@binos/server/apps/music/types'
import type { ComponentType } from 'react'
import { catalog } from './api.ts'
import type { PlaybackProvider } from './types.ts'
import { youtubeProvider } from './youtube.ts'
import { YouTubeInspector, YouTubeSettings } from './YouTubeSettings.tsx'

export type MusicProvider = PlaybackProvider & {
  acceptsLink(input: string): boolean
  search(query: string, page?: string, signal?: AbortSignal): Promise<CatalogPage>
  resolve(input: string, page?: string, signal?: AbortSignal): Promise<CatalogPage>
  Settings?: ComponentType
  Inspector?: ComponentType
}

export const musicProviders: MusicProvider[] = [{
  ...youtubeProvider,
  acceptsLink: (input) => /^https?:\/\//i.test(input) || /^[\w-]{11}$/.test(input),
  search: (query, page, signal) => catalog('youtube', 'search', query, page, signal),
  resolve: (input, page, signal) => catalog('youtube', 'resolve', input, page, signal),
  Settings: YouTubeSettings,
  Inspector: YouTubeInspector,
}]

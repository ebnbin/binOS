import type { ComponentType } from 'react'
import type { MusicPlayer, PlayerEvent } from './types.ts'
import { createYouTubePlayer } from './youtube.ts'
import { YouTubeInspector } from './YouTubeInspector.tsx'

export const embeds: Record<string, { create(emit: (event: PlayerEvent) => void): MusicPlayer; Inspector?: ComponentType } | undefined> = {
  youtube: { create: createYouTubePlayer, Inspector: YouTubeInspector },
}

export type TrackRef = { provider: string; id: string }

export type Track = {
  ref: TrackRef
  title: string
  artists: string[]
  artworkUrl?: string
  durationMs?: number
  externalUrl: string
}

export type CatalogPage = { tracks: Track[]; nextPage?: string; warning?: string }

export type MusicErrorCode = 'configuration' | 'invalid-input' | 'unavailable' | 'quota' | 'network'

export type MusicApiError = { error: string; code: MusicErrorCode }

export type QueueOperation = { type: 'add' | 'initialize'; tracks: Track[] } | { type: 'remove'; ref: TrackRef } | { type: 'clear' }
export type QueueSnapshot = { revision: number; tracks: Track[] }
export type QueueMutation = { id: string; operation: QueueOperation }

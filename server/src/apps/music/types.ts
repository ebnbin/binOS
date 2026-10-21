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

export type TrackRef = { provider: string; id: string }

export type Track = {
  ref: TrackRef
  title: string
  artists: string[]
  album?: { id?: string; title: string }
  artworkUrl?: string
  durationMs?: number
  externalUrl: string
}

export type CatalogPage = { tracks: Track[]; nextPage?: string; warning?: string }

export type MusicErrorCode = 'configuration' | 'invalid-input' | 'unavailable' | 'quota' | 'network' | 'unsupported'

export type MusicApiError = { error: string; code: MusicErrorCode }

export type QueueOperation = { type: 'add' | 'initialize'; tracks: Track[] } | { type: 'remove'; ref: TrackRef } | { type: 'clear' }
export type QueueSnapshot = { revision: number; tracks: Track[] }
export type QueueMutation = { id: string; operation: QueueOperation }

export type Capability = { state: 'available' } | { state: 'unsupported' } | { state: 'configuration-required'; reason: string }
export type ProviderCapabilities = Record<'search' | 'resolve' | 'playlist' | 'recommendations' | 'lyrics' | 'playback', Capability>
export type ProviderInfo = {
  id: string
  name: string
  description: string
  input: { references: { pattern: string; capability: 'resolve' | 'playlist' }[] }
  capabilities: ProviderCapabilities
  configuration: { fields: { id: string; label: string; description: string; secret: boolean; configured: boolean; links?: { label: string; url: string }[] }[] }
}
export type Lyrics = { text: string; attribution?: string }
export type PlaybackSource =
  | { kind: 'audio'; url: string; expiresAt?: number; controls: { seek: boolean; volume: boolean } }
  | { kind: 'embed'; engine: string; id: string; controls: { seek: boolean; volume: boolean } }

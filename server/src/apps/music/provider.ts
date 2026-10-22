import type { CatalogPage, Lyrics, MusicErrorCode, PlaybackSource, ProviderInfo, TrackRef } from './types.js'

export class MusicError extends Error {
  code: MusicErrorCode
  constructor(message: string, code: MusicErrorCode) { super(message); this.code = code }
}

export interface MusicProvider {
  info(): ProviderInfo
  configure?(values: Record<string, string>): void
  search?(query: string, page?: string): Promise<CatalogPage>
  resolve?(input: string, page?: string): Promise<CatalogPage>
  recommendations?(id: string, page?: string): Promise<CatalogPage>
  lyrics?(id: string): Promise<Lyrics>
  playback?(ref: TrackRef): Promise<PlaybackSource>
  stream?(id: string, range: string | undefined, signal: AbortSignal): Promise<Response>
}

export function requireCapability(provider: MusicProvider, capability: keyof ProviderInfo['capabilities']) {
  const state = provider.info().capabilities[capability]
  if (!state || state.state === 'unsupported') throw new MusicError('这个音乐来源不支持此功能。', 'unsupported')
  if (state.state !== 'available') throw new MusicError(state.reason, 'configuration')
}

import { playbackSource } from './api.ts'
import type { MusicPlayer, PlayerEvent, PlayerFactory, TrackRef } from './types.ts'
import { embeds } from './playbackEngines.ts'

class AudioPlayer implements MusicPlayer {
  private audio = new Audio()
  private emit: (event: PlayerEvent) => void
  private source: string
  private destroyed = false
  constructor(source: string, emit: (event: PlayerEvent) => void) {
    this.source = source; this.emit = emit
    const progress = () => emit({ positionMs: this.audio.currentTime * 1000, durationMs: Number.isFinite(this.audio.duration) ? this.audio.duration * 1000 : 0 })
    this.audio.addEventListener('timeupdate', progress)
    this.audio.addEventListener('loadedmetadata', progress)
    this.audio.addEventListener('durationchange', progress)
    this.audio.addEventListener('playing', () => emit({ status: 'playing' }))
    this.audio.addEventListener('pause', () => { if (!this.audio.ended) emit({ status: 'paused' }) })
    this.audio.addEventListener('waiting', () => { if (!this.audio.paused) emit({ status: 'loading' }) })
    this.audio.addEventListener('ended', () => emit({ status: 'ended' }))
    this.audio.addEventListener('error', () => { if (!this.destroyed) emit({ status: 'error', error: '无法读取音频，请重试或检查此来源的连接设置。' }) })
  }
  async load() { this.audio.preload = 'metadata'; this.audio.src = this.source; this.audio.load() }
  play() { void this.audio.play().catch(error => { if (!this.destroyed) this.emit({ status: 'error', error: error instanceof DOMException && error.name === 'NotAllowedError' ? '浏览器阻止了播放，请再点击一次播放。' : '音频播放失败，请重试。' }) }) }
  pause() { this.audio.pause() }
  seek(positionMs: number) { this.audio.currentTime = positionMs / 1000 }
  setVolume(volume: number) { this.audio.volume = volume }
  destroy() { this.destroyed = true; this.audio.pause(); this.audio.removeAttribute('src'); this.audio.load() }
}

class ProviderPlayer implements MusicPlayer {
  private player?: MusicPlayer
  private request = new AbortController()
  private emit: (event: PlayerEvent) => void
  constructor(emit: (event: PlayerEvent) => void) { this.emit = emit }
  async load(ref: TrackRef) {
    const source = await playbackSource(ref.provider, ref.id, this.request.signal)
    if (this.request.signal.aborted) return
    if (source.kind === 'audio') {
      const url = new URL(source.url, window.location.origin)
      if (url.origin !== window.location.origin) throw new Error('播放服务返回了无效的音频入口。')
      this.player = new AudioPlayer(url.href, this.emit)
      this.emit({ controls: source.controls, embedEngine: undefined })
      await this.player.load(ref)
    } else {
      const engine = embeds[source.engine]
      if (!engine) throw new Error('当前设备尚不支持此播放方式。')
      this.player = engine.create(this.emit)
      this.emit({ controls: source.controls, embedEngine: source.engine })
      await this.player.load({ ...ref, id: source.id })
    }
  }
  play() { this.player?.play() }
  pause() { this.player?.pause() }
  seek(positionMs: number) { this.player?.seek(positionMs) }
  setVolume(volume: number) { this.player?.setVolume(volume) }
  destroy() { this.request.abort(); this.player?.destroy(); this.player = undefined }
}
export const createMusicPlayer: PlayerFactory = (_ref, emit) => new ProviderPlayer(emit)

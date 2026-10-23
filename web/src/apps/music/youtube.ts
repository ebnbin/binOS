import type { MusicPlayer, PlayerEvent, TrackRef } from './types.ts'
import styles from './music.module.css'

type YouTubePlayer = {
  playVideo(): void
  pauseVideo(): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  setVolume(volume: number): void
  getCurrentTime(): number
  getDuration(): number
  getPlayerState(): number
  destroy(): void
}
type YouTubeAPI = { Player: new (element: HTMLElement, options: {
  width: number; height: number; videoId: string; playerVars: Record<string, string | number>
  events: { onReady(): void; onStateChange(event: { data: number }): void; onError(event: { data: number }): void; onAutoplayBlocked(): void }
}) => YouTubePlayer }
type YouTubeWindow = Window & { YT?: YouTubeAPI; onYouTubeIframeAPIReady?: () => void }
const ytWindow = window as YouTubeWindow
let loading: Promise<YouTubeAPI> | undefined

function loadAPI(): Promise<YouTubeAPI> {
  if (ytWindow.YT?.Player) return Promise.resolve(ytWindow.YT)
  if (loading) return loading
  loading = new Promise<YouTubeAPI>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    const previous = ytWindow.onYouTubeIframeAPIReady
    const finish = (error?: Error) => {
      clearTimeout(timeout)
      ytWindow.onYouTubeIframeAPIReady = previous
      if (error) { script.remove(); loading = undefined; reject(error) }
      else resolve(ytWindow.YT!)
    }
    const timeout = window.setTimeout(() => finish(new Error('YouTube 播放器加载超时，请检查网络后重试。')), 15_000)
    ytWindow.onYouTubeIframeAPIReady = () => { previous?.(); finish() }
    script.onerror = () => finish(new Error('无法加载 YouTube 播放器，请检查网络或浏览器的内容拦截设置。'))
    document.head.append(script)
  })
  return loading
}

let previewVisible = false
const previewListeners = new Set<() => void>()
const hosts = new Set<HTMLElement>()
export const youtubePreview = {
  getSnapshot: () => previewVisible,
  subscribe: (listener: () => void) => { previewListeners.add(listener); return () => { previewListeners.delete(listener) } },
  setVisible(visible: boolean) {
    previewVisible = visible
    hosts.forEach((host) => { host.dataset.visible = String(visible); host.inert = !visible })
    previewListeners.forEach((listener) => listener())
  },
}

class YouTubeMusicPlayer implements MusicPlayer {
  private player?: YouTubePlayer
  private host?: HTMLElement
  private destroyed = false
  private ready = false
  private timer?: number
  private startTimer?: number
  private rejectReady?: (error: Error) => void

  private emit: (event: PlayerEvent) => void
  constructor(emit: (event: PlayerEvent) => void) { this.emit = emit }

  async load(track: TrackRef) {
    if (!/^[\w-]{11}$/.test(track.id)) throw new Error('YouTube 曲目 ID 无效。')
    const api = await loadAPI()
    if (this.destroyed) return
    const host = document.createElement('section')
    host.className = styles.playerHost
    host.dataset.visible = String(previewVisible)
    host.inert = !previewVisible
    host.setAttribute('aria-label', 'YouTube 视频预览')
    const bar = document.createElement('div')
    bar.className = styles.previewBar
    const title = document.createElement('span')
    title.textContent = 'YouTube'
    const close = document.createElement('button')
    close.type = 'button'
    close.textContent = '关闭预览'
    close.onclick = () => youtubePreview.setVisible(false)
    bar.append(title, close)
    const frame = document.createElement('div')
    host.append(bar, frame)
    // 放进 Radix 的根主题里，才能取到主题的 token 和深浅色
    const theme = document.querySelector('.radix-themes[data-is-root-theme="true"]') ?? document.body
    theme.append(host)
    this.host = host
    hosts.add(host)
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        this.rejectReady = undefined
        reject(new Error('YouTube 未能就绪，请重试或打开视频预览检查。'))
      }, 15_000)
      this.rejectReady = (error) => { clearTimeout(timeout); reject(error) }
      this.player = new api.Player(frame, {
        width: 320, height: 200, videoId: track.id,
        playerVars: { origin: window.location.origin, playsinline: 1, autoplay: 0, controls: 1, rel: 0 },
        events: {
          onReady: () => {
            clearTimeout(timeout)
            this.rejectReady = undefined
            if (this.destroyed) return
            this.ready = true
            this.timer = window.setInterval(() => {
              if (this.player && [1, 2, 5].includes(this.player.getPlayerState())) this.progress()
            }, 500)
            resolve()
          },
          onStateChange: ({ data }) => {
            if (this.destroyed) return
            if (data !== 3) clearTimeout(this.startTimer)
            this.progress()
            const status = ({ 0: 'ended', 1: 'playing', 2: 'paused', 3: 'loading' } as const)[data as 0 | 1 | 2 | 3]
            if (status) this.emit({ status })
          },
          onError: ({ data }) => {
            if (this.destroyed) return
            clearTimeout(this.startTimer)
            const error = data === 153 ? 'YouTube 无法验证播放来源，请检查浏览器的 Referer 或隐私设置。'
              : data === 100 ? '内容已删除或未公开，请换一首。'
                : data === 101 || data === 150 ? '这首内容不允许嵌入播放，请换一首或在 YouTube 打开。'
                  : 'YouTube 播放失败，请重试或换一首。'
            if (this.rejectReady) { this.rejectReady(new Error(error)); this.rejectReady = undefined }
            this.emit({ status: 'error', error })
          },
          onAutoplayBlocked: () => {
            if (this.destroyed) return
            clearTimeout(this.startTimer)
            this.emit({ status: 'paused', error: '浏览器阻止了播放，请再点一次播放，或打开视频预览后重试。' })
          },
        },
      })
    })
  }

  private progress() {
    if (!this.ready || !this.player) return
    const positionMs = this.player.getCurrentTime() * 1000
    const durationMs = this.player.getDuration() * 1000
    if (Number.isFinite(positionMs) && Number.isFinite(durationMs)) this.emit({ positionMs, durationMs })
  }

  play() {
    if (!this.ready) return
    clearTimeout(this.startTimer)
    this.emit({ status: 'loading' })
    this.startTimer = window.setTimeout(() => this.emit({ status: 'paused', error: '播放尚未开始，请重试或打开视频预览检查。' }), 20_000)
    this.player?.playVideo()
  }
  pause() { clearTimeout(this.startTimer); if (this.ready) this.player?.pauseVideo() }
  seek(positionMs: number) { if (this.ready) this.player?.seekTo(positionMs / 1000, true) }
  setVolume(volume: number) { if (this.ready) this.player?.setVolume(volume * 100) }
  destroy() {
    this.destroyed = true
    clearInterval(this.timer)
    clearTimeout(this.startTimer)
    this.rejectReady?.(new Error('播放已取消。'))
    this.rejectReady = undefined
    this.player?.destroy()
    if (this.host) { hosts.delete(this.host); this.host.remove() }
  }
}

export const createYouTubePlayer = (emit: (event: PlayerEvent) => void): MusicPlayer => new YouTubeMusicPlayer(emit)

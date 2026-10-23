import { IconButton, Slider, Spinner, Text } from '@radix-ui/themes'
import { LoopIcon, PauseIcon, PlayIcon, RepeatOneIcon, SpeakerLoudIcon, SpeakerOffIcon, TrackNextIcon, TrackPreviousIcon } from '../../ui/icons.ts'
import { music, useMusic } from './store.ts'
import { useProviders } from './providers.ts'
import styles from './music.module.css'

function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

// 紧凑版用在 widget 和悬浮播放器里：size 2 的按钮；完整版是音乐 app 里的 size 3 按钮和 size 4 的播放键
export function Transport({ compact = false }: { compact?: boolean }) {
  const state = useMusic()
  const { providers } = useProviders()
  const current = state.queue[state.index]
  const playable = providers.find(provider => provider.id === current?.ref.provider)?.capabilities.playback.state === 'available'
  const active = state.status === 'playing' || state.status === 'loading'
  const glyph = compact ? 15 : 18
  return (
    <div className={styles.transport} data-compact={compact}>
      <IconButton type="button" variant="ghost" color="gray" size={compact ? '2' : '3'} aria-label="上一首" title="上一首" disabled={!state.queue.length} onClick={() => music.previous()}><TrackPreviousIcon width={glyph} height={glyph} /></IconButton>
      <IconButton type="button" variant="solid" radius="full" size={compact ? '2' : '4'} aria-label={active ? '暂停' : state.status === 'error' ? '重试播放' : '播放'} title={active ? '暂停' : '播放'} disabled={!state.queue.length || !active && !playable} onClick={() => music.toggle()}>
        {state.status === 'loading' ? <Spinner size={compact ? '2' : '3'} /> : active ? <PauseIcon width={compact ? 15 : 22} height={compact ? 15 : 22} /> : <PlayIcon width={compact ? 15 : 22} height={compact ? 15 : 22} />}
      </IconButton>
      <IconButton type="button" variant="ghost" color="gray" size={compact ? '2' : '3'} aria-label="下一首" title="下一首" disabled={!state.queue.length} onClick={() => music.next()}><TrackNextIcon width={glyph} height={glyph} /></IconButton>
    </div>
  )
}

export function PlayerControls() {
  const state = useMusic()
  const repeatLabel = state.repeat === 'off' ? '顺序播放' : state.repeat === 'all' ? '列表循环' : '单曲循环'
  const repeating = state.repeat !== 'off'
  const Repeat = state.repeat === 'one' ? RepeatOneIcon : LoopIcon
  return (
    <div className={styles.controls}>
      <div className={styles.progress}>
        <Slider size="1" aria-label="播放进度" min={0} max={state.durationMs || 1} step={1000} value={[Math.min(state.positionMs, state.durationMs || 0)]} disabled={state.controls?.seek === false || !state.durationMs || ['idle', 'error'].includes(state.status)} onValueChange={([value]) => music.seek(value!)} />
        <Text as="div" size="1" color="gray" className={styles.times}><span>{formatDuration(state.positionMs)}</span><span>{state.durationMs ? formatDuration(state.durationMs) : '—:—'}</span></Text>
      </div>
      <div className={styles.controlRow}>
        <IconButton type="button" size="2" variant={repeating ? 'soft' : 'ghost'} color={repeating ? undefined : 'gray'} className={styles.repeat} aria-label={repeatLabel} title={repeatLabel} onClick={() => music.cycleRepeat()}><Repeat /></IconButton>
        <Transport />
        <div className={styles.volume} title="音量">
          {state.volume ? <SpeakerLoudIcon /> : <SpeakerOffIcon />}
          <Slider size="1" aria-label="音量" min={0} max={1} step={0.01} value={[state.volume]} disabled={state.controls?.volume === false} onValueChange={([value]) => music.setVolume(value!)} />
        </div>
      </div>
    </div>
  )
}

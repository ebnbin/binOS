import type { CSSProperties } from 'react'
import { IconButton } from '../../ui/IconButton.tsx'
import { Pause, PlayArrow, Repeat, RepeatOne, SkipNext, SkipPrevious, VolumeOff, VolumeUp } from '../../ui/icons.tsx'
import { CircularProgress } from '../../ui/Progress.tsx'
import { Tooltip } from '../../ui/Tooltip.tsx'
import { music, useMusic } from './store.ts'
import { useProviders } from './providers.ts'
import styles from './music.module.css'

function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

// 滑块的已播放段由 CSS 按 --value 画出
const fill = (value: number, max: number) => ({ '--value': max > 0 ? Math.min(1, Math.max(0, value / max)) : 0 }) as CSSProperties

export function Transport({ compact = false }: { compact?: boolean }) {
  const state = useMusic()
  const { providers } = useProviders()
  const current = state.queue[state.index]
  const playable = providers.find(provider => provider.id === current?.ref.provider)?.capabilities.playback.state === 'available'
  const active = state.status === 'playing' || state.status === 'loading'
  const playLabel = active ? '暂停' : state.status === 'error' ? '重试播放' : '播放'
  return (
    <div className={styles.transport} data-compact={compact}>
      <IconButton icon={SkipPrevious} label="上一首" size={compact ? 's' : 'm'} disabled={!state.queue.length} onClick={() => music.previous()} />
      <Tooltip label={playLabel}>
        <button type="button" className={styles.play} data-active={active} aria-label={playLabel} disabled={!state.queue.length || !active && !playable} onClick={() => music.toggle()}>
          {state.status === 'loading' ? <CircularProgress size={compact ? 20 : 24} label="正在连接" /> : active ? <Pause size={compact ? 24 : 32} filled /> : <PlayArrow size={compact ? 24 : 32} filled />}
        </button>
      </Tooltip>
      <IconButton icon={SkipNext} label="下一首" size={compact ? 's' : 'm'} disabled={!state.queue.length} onClick={() => music.next()} />
    </div>
  )
}

export function PlayerControls() {
  const state = useMusic()
  const repeatLabel = state.repeat === 'off' ? '顺序播放' : state.repeat === 'all' ? '列表循环' : '单曲循环'
  const position = Math.min(state.positionMs, state.durationMs || 0)
  return (
    <div className={styles.controls}>
      <div className={styles.progress}>
        <input type="range" className={styles.slider} style={fill(position, state.durationMs)} aria-label="播放进度" min={0} max={state.durationMs || 1} step={1000} value={position} disabled={state.controls?.seek === false || !state.durationMs || ['idle', 'error'].includes(state.status)} onChange={(event) => music.seek(Number(event.target.value))} />
        <div className={styles.times}><span>{formatDuration(state.positionMs)}</span><span>{state.durationMs ? formatDuration(state.durationMs) : '—:—'}</span></div>
      </div>
      <div className={styles.controlRow}>
        <IconButton icon={state.repeat === 'one' ? RepeatOne : Repeat} label={repeatLabel} variant="filled" className={styles.repeat} selected={state.repeat !== 'off'} onClick={() => music.cycleRepeat()} />
        <Transport />
        <label className={styles.volume} title="音量">
          {state.volume ? <VolumeUp size={20} /> : <VolumeOff size={20} />}
          <input type="range" className={styles.slider} data-size="small" style={fill(state.volume, 1)} aria-label="音量" min={0} max={1} step={0.01} value={state.volume} disabled={state.controls?.volume === false} onChange={(event) => music.setVolume(Number(event.target.value))} />
        </label>
      </div>
    </div>
  )
}

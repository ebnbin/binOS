import type { CSSProperties } from 'react'
import { ActionButton } from '../../ui/ActionButton.tsx'
import { Button } from '../../ui/Button.tsx'
import { IconButton } from '../../ui/IconButton.tsx'
import { Pause, Play, Repeat, RepeatOne, StepBackward, StepForward, VolumeOff, VolumeTwo } from '../../ui/icons.tsx'
import { ProgressCircle } from '../../ui/ProgressCircle.tsx'
import { music, useMusic } from './store.ts'
import { useProviders } from './providers.ts'
import styles from './music.module.css'

function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

const fill = (value: number, max: number) => ({ '--fill': `${max > 0 ? Math.min(100, Math.max(0, value / max * 100)) : 0}%` }) as CSSProperties

// 上一首、下一首是 quiet action button；播放是视图里最主要的操作，用 accent 的圆形按钮
export function Transport({ compact = false }: { compact?: boolean }) {
  const state = useMusic()
  const { providers } = useProviders()
  const current = state.queue[state.index]
  const playable = providers.find(provider => provider.id === current?.ref.provider)?.capabilities.playback.state === 'available'
  const active = state.status === 'playing' || state.status === 'loading'
  const size = compact ? 'M' : 'L'
  const iconSize = compact ? 'M' : 'L'
  return (
    <div className={styles.transport} data-compact={compact}>
      <IconButton icon={StepBackward} label="上一首" size={size} disabled={!state.queue.length} onClick={() => music.previous()} />
      <Button
        variant="accent" size={size} className={styles.play}
        aria-label={active ? '暂停' : state.status === 'error' ? '重试播放' : '播放'} title={active ? '暂停' : '播放'}
        disabled={!state.queue.length || !active && !playable} onClick={() => music.toggle()}
      >
        {state.status === 'loading' ? <ProgressCircle staticColor="white" label="正在连接" /> : active ? <Pause size={iconSize} /> : <Play size={iconSize} />}
      </Button>
      <IconButton icon={StepForward} label="下一首" size={size} disabled={!state.queue.length} onClick={() => music.next()} />
    </div>
  )
}

export function PlayerControls() {
  const state = useMusic()
  const repeatLabel = state.repeat === 'off' ? '顺序播放' : state.repeat === 'all' ? '列表循环' : '单曲循环'
  const duration = state.durationMs || 0
  const position = Math.min(state.positionMs, duration)
  return (
    <div className={styles.controls}>
      <div className={styles.progress}>
        <input
          type="range" className={styles.slider} style={fill(position, duration)} aria-label="播放进度"
          min={0} max={duration || 1} step={1000} value={position}
          disabled={state.controls?.seek === false || !state.durationMs || ['idle', 'error'].includes(state.status)}
          onChange={(event) => music.seek(Number(event.target.value))}
        />
        <div className={styles.times}><span>{formatDuration(state.positionMs)}</span><span>{state.durationMs ? formatDuration(state.durationMs) : '—:—'}</span></div>
      </div>
      <div className={styles.controlRow}>
        <ActionButton icon={state.repeat === 'one' ? RepeatOne : Repeat} label={repeatLabel} quiet selected={state.repeat !== 'off'} className={styles.repeat} onClick={() => music.cycleRepeat()} />
        <Transport />
        <label className={styles.volume} title="音量">
          {state.volume ? <VolumeTwo size="M" /> : <VolumeOff size="M" />}
          <input
            type="range" className={styles.slider} style={fill(state.volume, 1)} aria-label="音量"
            min={0} max={1} step={0.01} value={state.volume} disabled={state.controls?.volume === false}
            onChange={(event) => music.setVolume(Number(event.target.value))}
          />
        </label>
      </div>
    </div>
  )
}

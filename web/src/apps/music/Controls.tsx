import { Slider } from '@react-spectrum/s2'
import { Button } from '../../ui/Button.tsx'
import { LoaderCircle, Pause, Play, Repeat, Repeat1, SkipBack, SkipForward, Volume2, VolumeX } from '../../ui/icons.tsx'
import { music, useMusic } from './store.ts'
import { useProviders } from './providers.ts'
import styles from './music.module.css'

function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export function Transport({ compact = false }: { compact?: boolean }) {
  const state = useMusic()
  const { providers } = useProviders()
  const current = state.queue[state.index]
  const playable =
    providers.find((provider) => provider.id === current?.ref.provider)?.capabilities.playback.state === 'available'
  const active = state.status === 'playing' || state.status === 'loading'
  return (
    <div className={styles.transport} data-compact={compact}>
      <Button
        type="button"
        aria-label="上一首"
        title="上一首"
        disabled={!state.queue.length}
        onPress={() => music.previous()}
      >
        <SkipBack size={compact ? 16 : 20} />
      </Button>
      <Button
        type="button"
        className={styles.play}
        aria-label={active ? '暂停' : state.status === 'error' ? '重试播放' : '播放'}
        title={active ? '暂停' : '播放'}
        disabled={!state.queue.length || (!active && !playable)}
        onPress={() => music.toggle()}
      >
        {state.status === 'loading' ? (
          <LoaderCircle className={styles.spinner} size={compact ? 18 : 24} />
        ) : active ? (
          <Pause size={compact ? 18 : 24} fill="currentColor" />
        ) : (
          <Play size={compact ? 18 : 24} fill="currentColor" />
        )}
      </Button>
      <Button
        type="button"
        aria-label="下一首"
        title="下一首"
        disabled={!state.queue.length}
        onPress={() => music.next()}
      >
        <SkipForward size={compact ? 16 : 20} />
      </Button>
    </div>
  )
}

export function PlayerControls() {
  const state = useMusic()
  const repeatLabel = state.repeat === 'off' ? '顺序播放' : state.repeat === 'all' ? '列表循环' : '单曲循环'
  return (
    <div className={styles.controls}>
      <div className={styles.progress}>
        <Slider
          aria-label="播放进度"
          minValue={0}
          maxValue={state.durationMs || 1}
          step={1000}
          value={Math.min(state.positionMs, state.durationMs || 0)}
          isDisabled={state.controls?.seek === false || !state.durationMs || ['idle', 'error'].includes(state.status)}
          onChange={(value) => music.seek(value)}
        />
        <div className={styles.times}>
          <span>{formatDuration(state.positionMs)}</span>
          <span>{state.durationMs ? formatDuration(state.durationMs) : '—:—'}</span>
        </div>
      </div>
      <div className={styles.controlRow}>
        <Button
          type="button"
          className={styles.repeat}
          data-active={state.repeat !== 'off'}
          aria-label={repeatLabel}
          title={repeatLabel}
          onPress={() => music.cycleRepeat()}
        >
          {state.repeat === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}
        </Button>
        <Transport />
        <label className={styles.volume} title="音量">
          {state.volume ? <Volume2 size={17} /> : <VolumeX size={17} />}
          <Slider
            formatOptions={{ style: 'percent' }}
            aria-label="音量"
            minValue={0}
            maxValue={1}
            step={0.01}
            value={state.volume}
            isDisabled={state.controls?.volume === false}
            onChange={(value) => music.setVolume(value)}
          />
        </label>
      </div>
    </div>
  )
}

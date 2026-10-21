import { Button, Slider, ToggleButton } from '@fluentui/react-components'

import {
  ArrowClockwiseRegular as LoaderCircle,
  ArrowRepeat1Regular as Repeat1,
  ArrowRepeatAllRegular as Repeat,
  NextRegular as SkipForward,
  PauseRegular as Pause,
  PlayRegular as Play,
  PreviousRegular as SkipBack,
  Speaker2Regular as Volume2,
  SpeakerOffRegular as VolumeX,
} from '@fluentui/react-icons'
import { music, useMusic } from './store.ts'
import styles from './music.module.css'

function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export function Transport({ compact = false }: { compact?: boolean }) {
  const state = useMusic()
  const active = state.status === 'playing' || state.status === 'loading'
  return (
    <div className={styles.transport} data-compact={compact}>
      <Button
        size="small"
        icon={<SkipBack fontSize={compact ? 16 : 20} />}
        appearance="subtle"
        type="button"
        aria-label="上一首"
        title="上一首"
        disabled={!state.queue.length}
        onClick={() => music.previous()}
      />
      <Button
        size="small"
        appearance="primary"
        type="button"
        className={styles.play}
        aria-label={active ? '暂停' : state.status === 'error' ? '重试播放' : '播放'}
        title={active ? '暂停' : '播放'}
        disabled={!state.queue.length}
        onClick={() => music.toggle()}
      >
        {state.status === 'loading' ? (
          <LoaderCircle className={styles.spinner} fontSize={compact ? 18 : 24} />
        ) : active ? (
          <Pause fontSize={compact ? 18 : 24} fill="currentColor" />
        ) : (
          <Play fontSize={compact ? 18 : 24} fill="currentColor" />
        )}
      </Button>
      <Button
        size="small"
        icon={<SkipForward fontSize={compact ? 16 : 20} />}
        appearance="subtle"
        type="button"
        aria-label="下一首"
        title="下一首"
        disabled={!state.queue.length}
        onClick={() => music.next()}
      />
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
          min={0}
          max={state.durationMs || 1}
          step={1000}
          value={Math.min(state.positionMs, state.durationMs || 0)}
          disabled={!state.durationMs || ['idle', 'error'].includes(state.status)}
          onChange={(_, data) => music.seek(data.value)}
        />
        <div className={styles.times}>
          <span>{formatDuration(state.positionMs)}</span>
          <span>{state.durationMs ? formatDuration(state.durationMs) : '—:—'}</span>
        </div>
      </div>
      <div className={styles.controlRow}>
        <ToggleButton
          checked={Boolean(state.repeat !== 'off')}
          size="small"
          appearance="subtle"
          type="button"
          className={styles.repeat}
          data-active={state.repeat !== 'off'}
          aria-label={repeatLabel}
          title={repeatLabel}
          onClick={() => music.cycleRepeat()}
        >
          {state.repeat === 'one' ? <Repeat1 fontSize={18} /> : <Repeat fontSize={18} />}
        </ToggleButton>
        <Transport />
        <label className={styles.volume} title="音量">
          {state.volume ? <Volume2 fontSize={17} /> : <VolumeX fontSize={17} />}
          <Slider aria-label="音量" min={0} max={1} step={0.01} value={state.volume} onChange={(_, data) => music.setVolume(data.value)} />
        </label>
      </div>
    </div>
  )
}

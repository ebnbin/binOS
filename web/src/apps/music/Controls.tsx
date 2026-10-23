import { ArrowRepeat1Filled } from '@fluentui/react-icons/headless/svg/arrow-repeat'
import { ArrowRepeatAllFilled, ArrowRepeatAllRegular } from '@fluentui/react-icons/headless/svg/arrow-repeat-all'
import { NextFilled } from '@fluentui/react-icons/headless/svg/next'
import { PauseFilled } from '@fluentui/react-icons/headless/svg/pause'
import { PlayFilled } from '@fluentui/react-icons/headless/svg/play'
import { PreviousFilled } from '@fluentui/react-icons/headless/svg/previous'
import { Speaker2Regular } from '@fluentui/react-icons/headless/svg/speaker'
import { SpeakerMuteRegular } from '@fluentui/react-icons/headless/svg/speaker-mute'
import { Button } from '../../ui/Button.tsx'
import { Slider } from '../../ui/Slider.tsx'
import { Spinner } from '../../ui/Spinner.tsx'
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
  const playable = providers.find(provider => provider.id === current?.ref.provider)?.capabilities.playback.state === 'available'
  const active = state.status === 'playing' || state.status === 'loading'
  return (
    <div className={styles.transport} data-compact={compact}>
      <Button appearance="subtle" shape="circular" size={compact ? 'medium' : 'large'} icon={<PreviousFilled />} aria-label="上一首" title="上一首" disabled={!state.queue.length} onClick={() => music.previous()} />
      <Button
        className={styles.play}
        appearance="primary"
        shape="circular"
        size={compact ? 'medium' : 'large'}
        icon={state.status === 'loading' ? <Spinner size={compact ? 'extra-tiny' : 'tiny'} label="正在连接" /> : active ? <PauseFilled /> : <PlayFilled />}
        aria-label={active ? '暂停' : state.status === 'error' ? '重试播放' : '播放'}
        title={active ? '暂停' : '播放'}
        disabled={!state.queue.length || !active && !playable}
        onClick={() => music.toggle()}
      />
      <Button appearance="subtle" shape="circular" size={compact ? 'medium' : 'large'} icon={<NextFilled />} aria-label="下一首" title="下一首" disabled={!state.queue.length} onClick={() => music.next()} />
    </div>
  )
}

export function PlayerControls() {
  const state = useMusic()
  const repeatLabel = state.repeat === 'off' ? '顺序播放' : state.repeat === 'all' ? '列表循环' : '单曲循环'
  return (
    <div className={styles.controls}>
      <div className={styles.progress}>
        <Slider aria-label="播放进度" min={0} max={state.durationMs || 1} step={1000} value={Math.min(state.positionMs, state.durationMs || 0)} disabled={state.controls?.seek === false || !state.durationMs || ['idle', 'error'].includes(state.status)} onChange={(event) => music.seek(Number(event.target.value))} />
        <div className={styles.times}><span>{formatDuration(state.positionMs)}</span><span>{state.durationMs ? formatDuration(state.durationMs) : '—:—'}</span></div>
      </div>
      <div className={styles.controlRow}>
        <Button className={styles.repeat} appearance="subtle" icon={state.repeat === 'one' ? <ArrowRepeat1Filled /> : state.repeat === 'all' ? <ArrowRepeatAllFilled /> : <ArrowRepeatAllRegular />} aria-pressed={state.repeat !== 'off'} aria-label={repeatLabel} title={repeatLabel} onClick={() => music.cycleRepeat()} />
        <Transport />
        <label className={styles.volume} title="音量">
          {state.volume ? <Speaker2Regular /> : <SpeakerMuteRegular />}
          <Slider aria-label="音量" min={0} max={1} step={0.01} value={state.volume} disabled={state.controls?.volume === false} onChange={(event) => music.setVolume(Number(event.target.value))} />
        </label>
      </div>
    </div>
  )
}

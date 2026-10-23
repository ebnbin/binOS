import { MoveToEndIcon, MoveToStartIcon, MuteIcon, PauseIcon, PlayIcon, SyncIcon, UnmuteIcon } from '@primer/octicons-react'
import type { CSSProperties } from 'react'
import { buttonProps } from '../../ui/button-props.ts'
import button from '../../ui/Button.module.css'
import { IconButton } from '../../ui/IconButton.tsx'
import { Spinner } from '../../ui/Spinner.tsx'
import { Tooltip } from '../../ui/Tooltip.tsx'
import { music, useMusic } from './store.ts'
import { useProviders } from './providers.ts'
import styles from './music.module.css'

function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

// 滑条已走过的部分用强调色，由 --progress 决定
const filled = (value: number, max: number) => ({ '--progress': `${max ? Math.min(100, value / max * 100) : 0}%` }) as CSSProperties

export function Transport({ compact = false }: { compact?: boolean }) {
  const state = useMusic()
  const { providers } = useProviders()
  const current = state.queue[state.index]
  const playable = providers.find(provider => provider.id === current?.ref.provider)?.capabilities.playback.state === 'available'
  const active = state.status === 'playing' || state.status === 'loading'
  const label = active ? '暂停' : state.status === 'error' ? '重试播放' : '播放'
  return (
    <div className={styles.transport} data-compact={compact}>
      <IconButton icon={MoveToStartIcon} label="上一首" size={compact ? 'small' : 'medium'} disabled={!state.queue.length} onClick={() => music.previous()} />
      <Tooltip text={label}>
        <button type="button" aria-label={label} {...buttonProps({ variant: 'default', size: compact ? 'medium' : 'large' }, styles.play)} data-icon-only="" disabled={!state.queue.length || !active && !playable} onClick={() => music.toggle()}>
          <span className={button.visual}>{state.status === 'loading' ? <Spinner /> : active ? <PauseIcon size={16} /> : <PlayIcon size={16} />}</span>
        </button>
      </Tooltip>
      <IconButton icon={MoveToEndIcon} label="下一首" size={compact ? 'small' : 'medium'} disabled={!state.queue.length} onClick={() => music.next()} />
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
        <input type="range" className={styles.range} style={filled(position, duration)} aria-label="播放进度" min={0} max={state.durationMs || 1} step={1000} value={position} disabled={state.controls?.seek === false || !state.durationMs || ['idle', 'error'].includes(state.status)} onChange={(event) => music.seek(Number(event.target.value))} />
        <div className={styles.times}><span>{formatDuration(state.positionMs)}</span><span>{state.durationMs ? formatDuration(state.durationMs) : '—:—'}</span></div>
      </div>
      <div className={styles.controlRow}>
        <Tooltip text={repeatLabel}>
          <button type="button" aria-label={repeatLabel} {...buttonProps({ variant: 'invisible', size: 'small' }, styles.repeat)} data-icon-only="" data-active={state.repeat !== 'off'} onClick={() => music.cycleRepeat()}>
            <span className={button.visual}><SyncIcon size={16} /></span>
            {state.repeat === 'one' && <span className={styles.repeatOne} aria-hidden>1</span>}
          </button>
        </Tooltip>
        <Transport />
        <label className={styles.volume} title="音量">
          {state.volume ? <UnmuteIcon size={16} /> : <MuteIcon size={16} />}
          <input type="range" className={styles.range} style={filled(state.volume, 1)} aria-label="音量" min={0} max={1} step={0.01} value={state.volume} disabled={state.controls?.volume === false} onChange={(event) => music.setVolume(Number(event.target.value))} />
        </label>
      </div>
    </div>
  )
}

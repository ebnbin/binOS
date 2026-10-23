import { MusicNote } from '../../ui/icons.tsx'
import type { WidgetContext } from '../types.ts'
import { Transport } from './Controls.tsx'
import { useMusic } from './store.ts'
import styles from './music.module.css'

export function MusicWidget({ size, open }: WidgetContext) {
  const state = useMusic()
  const track = state.queue[state.index]
  return (
    <div className={styles.widget} data-size={size}>
      <button type="button" className={styles.widgetInfo} onClick={(event) => { event.stopPropagation(); open('/') }} aria-label="打开音乐">
        <span className={styles.widgetArt} data-playing={state.status === 'playing'}>
          {track?.artworkUrl ? <img src={track.artworkUrl} alt="" referrerPolicy="no-referrer" /> : <MusicNote />}
        </span>
        <span className={styles.widgetText}>
          <span className={styles.widgetTitle}>{track?.title ?? '听点音乐'}</span>
          <span className={styles.widgetDetail}>{state.status === 'error' ? '播放失败，打开重试' : track ? track.artists.join(' / ') || '音乐' : '添加喜欢的歌曲'}</span>
        </span>
        {size !== '2x2' && <MusicNote size="S" className={styles.muted} />}
      </button>
      <div className={styles.widgetTransport} onClick={(event) => event.stopPropagation()}><Transport compact /></div>
      {size === '4x4' && <span className={styles.widgetCount}>{state.queue.length ? `${state.index + 1} / ${state.queue.length} 首` : '在音乐 app 中搜索或粘贴链接'}</span>}
    </div>
  )
}

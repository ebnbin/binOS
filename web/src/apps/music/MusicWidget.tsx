import { Button } from '@fluentui/react-components'
import { MusicNote2Regular as Disc3, MusicNote2Regular as Music2 } from '@fluentui/react-icons'
import type { WidgetContext } from '../types.ts'
import { Transport } from './Controls.tsx'
import { useMusic } from './store.ts'
import styles from './music.module.css'

export function MusicWidget({ size, open }: WidgetContext) {
  const state = useMusic()
  const track = state.queue[state.index]
  return (
    <div className={styles.widget} data-size={size}>
      <Button
        size="small"
        appearance="subtle"
        type="button"
        className={styles.widgetInfo}
        onClick={(event) => {
          event.stopPropagation()
          open('/')
        }}
        aria-label="打开音乐"
      >
        <span className={styles.widgetArt} data-playing={state.status === 'playing'}>
          {track?.artworkUrl ? <img src={track.artworkUrl} alt="" referrerPolicy="no-referrer" /> : <Disc3 fontSize={25} />}
        </span>
        <span className={styles.widgetText}>
          <strong>{track?.title ?? '听点音乐'}</strong>
          <span>{state.status === 'error' ? '播放失败，打开重试' : track ? track.artists.join(' / ') || '音乐' : '添加喜欢的歌曲'}</span>
        </span>
        {size !== '2x2' && <Music2 fontSize={16} className={styles.muted} />}
      </Button>
      <div className={styles.widgetTransport} onClick={(event) => event.stopPropagation()}>
        <Transport compact />
      </div>
      {size === '4x4' && (
        <span className={styles.widgetCount}>
          {state.queue.length ? `${state.index + 1} / ${state.queue.length} 首` : '在音乐 app 中搜索或粘贴链接'}
        </span>
      )}
    </div>
  )
}

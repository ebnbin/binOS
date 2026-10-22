import { SegmentedControl } from '../../ui/SegmentedControl.tsx'
import { Button, Input, NativeSelect } from '../../ui/Controls.tsx'
import { ArrowUpRight, Check, Disc3, ListMusic, Music2, Plus, Search, Settings2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { CatalogPage } from '@binos/server/apps/music/types'
import type { WindowContext } from '../types.ts'
import { trackKey } from './controller.ts'
import { PlayerControls } from './Controls.tsx'
import { music, musicProviders, useMusic, useQueueSync } from './store.ts'
import type { Track } from './types.ts'
import styles from './music.module.css'

export function MusicApp({ ctx }: { ctx: WindowContext }) {
  const state = useMusic()
  const queueStatus = useQueueSync()
  const track = state.queue[state.index]
  const [providerId, setProviderId] = useState(musicProviders[0].id)
  const provider = musicProviders.find((item) => item.id === providerId)!
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CatalogPage>()
  const [tab, setTab] = useState<'queue' | 'results'>('queue')
  const [settings, setSettings] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const request = useRef<AbortController | null>(null)
  const submitted = useRef({ query: '', providerId: '', operation: 'search' as 'search' | 'resolve' })
  const { setTitle } = ctx
  useEffect(() => {
    setTitle(track?.title ?? '')
  }, [track?.title, setTitle])
  useEffect(() => () => request.current?.abort(), [])

  async function search(more = false) {
    const value = query.trim()
    if (!more && !value) return
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    setMessage('')
    setTab('results')
    const params = more
      ? submitted.current
      : { query: value, providerId, operation: provider.acceptsLink(value) ? ('resolve' as const) : ('search' as const) }
    submitted.current = params
    if (!more) setResults(undefined)
    try {
      const source = musicProviders.find((item) => item.id === params.providerId)!
      const page = await source[params.operation](params.query, more ? results?.nextPage : undefined, controller.signal)
      if (controller.signal.aborted) return
      setResults((previous) => ({ ...page, tracks: more ? [...(previous?.tracks ?? []), ...page.tracks] : page.tracks }))
      if (page.warning) setMessage(page.warning)
    } catch (error) {
      if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : '请求失败，请检查网络后重试。')
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  const shown = tab === 'queue' ? state.queue : (results?.tracks ?? [])
  const queued = new Set(state.queue.map(trackKey))
  const Settings = provider.Settings
  const Inspector = musicProviders.find((source) => source.id === (track?.ref.provider ?? providerId))?.Inspector

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <span className={styles.brand}>
          <Music2 size={19} />
          音乐
        </span>
        {musicProviders.length > 1 ? (
          <NativeSelect
            aria-label="音乐来源"
            value={providerId}
            onChange={(event) => {
              request.current?.abort()
              setBusy(false)
              setResults(undefined)
              setMessage('')
              setProviderId(event.target.value)
            }}
          >
            {musicProviders.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </NativeSelect>
        ) : (
          <span className={styles.source}>{provider.name}</span>
        )}
        {Settings && (
          <Button
            type="button"
            className={styles.iconButton}
            aria-label="音乐设置"
            title="音乐设置"
            aria-expanded={settings}
            onClick={() => setSettings(!settings)}
          >
            <Settings2 size={18} />
          </Button>
        )}
      </header>
      {settings && Settings && <Settings />}
      <form
        className={styles.search}
        onSubmit={(event) => {
          event.preventDefault()
          void search()
        }}
      >
        <Search size={17} />
        <Input
          aria-label="搜索音乐或粘贴链接"
          placeholder="歌名、歌手或音乐链接"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          maxLength={500}
        />
        <Button className={styles.primary} disabled={!query.trim()}>
          查找
        </Button>
      </form>
      <section className={styles.nowPlaying} aria-label="正在播放">
        <span className={styles.artwork}>
          {track?.artworkUrl ? <img src={track.artworkUrl} alt="" referrerPolicy="no-referrer" /> : <Disc3 size={48} strokeWidth={1} />}
        </span>
        <div className={styles.trackInfo}>
          <span className={styles.eyebrow}>
            {state.status === 'playing'
              ? '正在播放'
              : state.status === 'loading'
                ? '正在连接…'
                : state.status === 'error'
                  ? '播放遇到问题'
                  : track
                    ? '随时继续'
                    : '你的音乐，随时播放'}
          </span>
          <h1>{track?.title ?? '从喜欢的一首开始'}</h1>
          <p>{track ? track.artists.join(' / ') || '未知艺人' : '粘贴单曲链接即可试听；在设置中开启按名称搜索。'}</p>
          {track && (
            <a href={track.externalUrl} target="_blank" rel="noreferrer" className={styles.trackLink}>
              在 {musicProviders.find((source) => source.id === track.ref.provider)?.name ?? track.ref.provider} 打开{' '}
              <ArrowUpRight size={12} />
            </a>
          )}
        </div>
      </section>
      {state.error && (
        <div role="alert" className={styles.error}>
          {state.error}
        </div>
      )}
      <PlayerControls />
      <div className={styles.tabs}>
        <SegmentedControl
          label="音乐内容"
          value={tab}
          onValueChange={setTab}
          options={[
            {
              value: 'queue',
              label: (
                <>
                  <ListMusic size={16} />
                  队列 <span>{state.queue.length}</span>
                </>
              ),
            },
            { value: 'results', label: <>查找结果{results && <span>{results.tracks.length}</span>}</> },
          ]}
        />
        <div className={styles.tabActions}>
          {tab === 'queue' && state.queue.length > 0 && (
            <Button type="button" onClick={() => music.clear()}>
              清空
            </Button>
          )}
          {tab === 'results' && shown.length > 0 && (
            <Button
              type="button"
              onClick={() => {
                music.add(shown)
                setTab('queue')
              }}
            >
              全部加入
            </Button>
          )}
        </div>
      </div>
      <div className={styles.content}>
        {message && (
          <p className={styles.notice} role="status">
            {message}
          </p>
        )}
        {shown.length === 0 ? (
          <div className={styles.empty}>
            <Disc3 size={32} strokeWidth={1.2} />
            <p>
              {busy
                ? '正在查找音乐…'
                : tab === 'queue'
                  ? '播放队列还是空的'
                  : results
                    ? '没有找到内容，试试其他关键词或链接'
                    : '搜索歌名，或粘贴 YouTube / YouTube Music 链接'}
            </p>
          </div>
        ) : (
          <ul className={styles.list}>
            {shown.map((item, index) => (
              <TrackRow
                key={`${trackKey(item)}:${index}`}
                track={item}
                active={!!track && trackKey(item) === trackKey(track)}
                queued={queued.has(trackKey(item))}
                queue={tab === 'queue'}
                onPlay={() => (tab === 'queue' ? void music.select(index) : music.add([item], true))}
                onAction={() => (tab === 'queue' ? music.remove(index) : music.add([item]))}
              />
            ))}
          </ul>
        )}
        {tab === 'results' && results?.nextPage && (
          <Button type="button" className={styles.loadMore} disabled={busy} onClick={() => void search(true)}>
            {busy ? '加载中…' : '加载更多'}
          </Button>
        )}
      </div>
      <footer className={styles.footer}>
        <span>{state.queue.length >= 500 ? '队列已满（500 首）' : queueStatus}</span>
        {Inspector && <Inspector />}
      </footer>
    </div>
  )
}

function TrackRow({
  track,
  active,
  queued,
  queue,
  onPlay,
  onAction,
}: {
  track: Track
  active: boolean
  queued: boolean
  queue: boolean
  onPlay(): void
  onAction(): void
}) {
  return (
    <li className={styles.row} data-active={active}>
      <Button type="button" className={styles.rowTrack} onClick={onPlay} title={`播放 ${track.title}`}>
        <span className={styles.thumb}>
          {track.artworkUrl ? <img src={track.artworkUrl} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <Music2 size={18} />}
        </span>
        <span className={styles.rowInfo}>
          <strong>{track.title}</strong>
          <span>{track.artists.join(' / ') || '未知艺人'}</span>
        </span>
      </Button>
      <Button
        type="button"
        className={styles.iconButton}
        aria-label={queue ? `移除 ${track.title}` : queued ? '已在队列中' : `加入队列 ${track.title}`}
        title={queue ? '移除' : queued ? '已在队列中' : '加入队列'}
        disabled={!queue && queued}
        onClick={onAction}
      >
        {queue ? <X size={16} /> : queued ? <Check size={16} /> : <Plus size={17} />}
      </Button>
    </li>
  )
}

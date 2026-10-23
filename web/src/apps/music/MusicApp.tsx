import { useEffect, useRef, useState } from 'react'
import type { CatalogPage, Lyrics, ProviderInfo } from '@binos/server/apps/music/types'
import type { WindowContext } from '../types.ts'
import { trackKey } from './controller.ts'
import { PlayerControls } from './Controls.tsx'
import { music, useMusic, useQueueSync } from './store.ts'
import type { Track } from './types.ts'
import { catalog, readLyrics } from './api.ts'
import { useProviders, refreshProviders } from './providers.ts'
import { ProviderSettings } from './ProviderSettings.tsx'
import { PlaybackInspector } from './PlaybackInspector.tsx'
import { ActionButton } from '../../ui/ActionButton.tsx'
import { Button } from '../../ui/Button.tsx'
import { IconButton } from '../../ui/IconButton.tsx'
import { Add, Checkmark, Close, MusicNote, OpenIn, Search, Settings } from '../../ui/icons.tsx'
import { InlineAlert } from '../../ui/InlineAlert.tsx'
import { ProgressCircle } from '../../ui/ProgressCircle.tsx'
import { Select } from '../../ui/Select.tsx'
import { UiIcon } from '../../ui/UiIcon.tsx'
import field from '../../ui/Field.module.css'
import tabs from '../../ui/Tabs.module.css'
import styles from './music.module.css'

const inputOperation = (provider: ProviderInfo, query: string): 'search' | 'resolve' | 'playlist' => provider.input.references.find(rule => new RegExp(rule.pattern, 'i').test(query))?.capability ?? 'search'

export function MusicApp({ ctx }: { ctx: WindowContext }) {
  const state = useMusic()
  const queueStatus = useQueueSync()
  const track = state.queue[state.index]
  const { providers: musicProviders, error: providersError } = useProviders()
  const [providerId, setProviderId] = useState('')
  const provider = musicProviders.find(item => item.id === providerId) ?? musicProviders[0]
  const currentProvider = musicProviders.find(item => item.id === track?.ref.provider)
  const [lyrics, setLyrics] = useState<{ key: string; value: Lyrics }>()
  const lyricProvider = track?.ref.provider
  const lyricId = track?.ref.id
  const lyricKey = track ? trackKey(track) : ''
  const currentLyrics = lyrics?.key === lyricKey ? lyrics.value : undefined
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CatalogPage>()
  const [tab, setTab] = useState<'queue' | 'results'>('queue')
  const [settings, setSettings] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const request = useRef<AbortController | null>(null)
  const submitted = useRef({ query: '', providerId: '', operation: 'search' as 'search' | 'resolve' | 'playlist' | 'recommendations' })
  const { setTitle } = ctx
  useEffect(() => { setTitle(track?.title ?? '') }, [track?.title, setTitle])
  useEffect(() => () => request.current?.abort(), [])

  async function search(more = false) {
    if (!provider) return
    const value = query.trim()
    if (!more && !value) return
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    setMessage('')
    setTab('results')
    const params = more ? submitted.current : { query: value, providerId: provider.id, operation: inputOperation(provider, value) }
    submitted.current = params
    if (!more) setResults(undefined)
    try {
      const page = await catalog(params.providerId, params.operation, params.query, more ? results?.nextPage : undefined, controller.signal)
      if (controller.signal.aborted) return
      setResults((previous) => ({ ...page, tracks: more ? [...(previous?.tracks ?? []), ...page.tracks] : page.tracks }))
      if (page.warning) setMessage(page.warning)
    } catch (error) {
      if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : '请求失败，请检查网络后重试。')
    } finally { if (!controller.signal.aborted) setBusy(false) }
  }

  const shown = tab === 'queue' ? state.queue : results?.tracks ?? []
  const queued = new Set(state.queue.map(trackKey))
  async function related() {
    if (!track) return
    request.current?.abort()
    const controller = new AbortController(); request.current = controller
    setBusy(true); setMessage(''); setTab('results'); setResults(undefined)
    submitted.current = { query: track.ref.id, providerId: track.ref.provider, operation: 'recommendations' }
    try { const page = await catalog(track.ref.provider, 'recommendations', track.ref.id, undefined, controller.signal); if (!controller.signal.aborted) setResults(page) }
    catch (error) { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : '无法读取推荐。') }
    finally { if (!controller.signal.aborted) setBusy(false) }
  }
  useEffect(() => {
    if (!lyricProvider || !lyricId || currentProvider?.capabilities.lyrics.state !== 'available') return
    const controller = new AbortController()
    readLyrics(lyricProvider, lyricId, controller.signal).then(value => { if (!controller.signal.aborted) setLyrics({ key: lyricKey, value }) }).catch(() => {})
    return () => controller.abort()
  }, [lyricProvider, lyricId, lyricKey, currentProvider?.capabilities.lyrics.state])
  if (!provider) return (
    <div className={styles.app}>
      <div className={styles.empty}>
        {providersError ? <MusicNote className={styles.emptyIcon} /> : <ProgressCircle size="M" label="正在读取音乐来源" />}
        <p>{providersError ?? '正在读取音乐来源…'}</p>
        {providersError && <Button variant="secondary" onClick={() => void refreshProviders()}>重试</Button>}
      </div>
    </div>
  )
  const operation = inputOperation(provider, query.trim())
  const resolving = operation !== 'search'
  const queryCapability = provider.capabilities[operation]

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <span className={styles.brand}>音乐</span>
        {musicProviders.length > 1
          ? <Select label="音乐来源" value={provider.id} options={musicProviders.map((source) => ({ value: source.id, label: source.name }))} onValueChange={(value) => { request.current?.abort(); setBusy(false); setResults(undefined); setMessage(''); setProviderId(value) }} className={styles.sourcePicker} />
          : <span className={styles.source}>{provider.name}</span>}
        {provider.configuration.fields.length > 0 && <IconButton icon={Settings} label="音乐设置" aria-expanded={settings} onClick={() => setSettings(!settings)} />}
      </header>
      {settings && <ProviderSettings key={provider.id} provider={provider} />}
      <p className={styles.providerDescription}>{provider.description}</p>
      {providersError && <InlineAlert variant="negative" fillStyle="subtleFill" className={styles.alert}>{providersError}</InlineAlert>}
      <form className={styles.search} onSubmit={(event) => { event.preventDefault(); void search() }}>
        <div className={`${field.group} ${field.search} ${styles.searchField}`}>
          <Search size="M" className={field.prefix} />
          <input className={field.groupInput} aria-label="搜索音乐或粘贴链接" placeholder="歌名、歌手或音乐链接" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={500} />
          {query && <button type="button" className={field.clear} aria-label="清除" onClick={() => setQuery('')}><UiIcon glyph="cross" /></button>}
        </div>
        <Button type="submit" variant="secondary" disabled={!query.trim() || queryCapability.state !== 'available'}>查找</Button>
      </form>
      {queryCapability.state === 'configuration-required' && <p className={styles.providerDescription}>{queryCapability.reason}</p>}
      {queryCapability.state === 'unsupported' && <p className={styles.providerDescription}>此来源不支持{resolving ? '链接导入' : '搜索'}。</p>}
      <section className={styles.nowPlaying} aria-label="正在播放">
        <span className={styles.artwork}>{track?.artworkUrl ? <img src={track.artworkUrl} alt="" referrerPolicy="no-referrer" /> : <MusicNote />}</span>
        <div className={styles.trackInfo}>
          <span className={styles.eyebrow}>{state.status === 'playing' ? '正在播放' : state.status === 'loading' ? '正在连接…' : state.status === 'error' ? '播放遇到问题' : track ? '随时继续' : '你的音乐，随时播放'}</span>
          <h1 className={styles.trackTitle}>{track?.title ?? '从喜欢的一首开始'}</h1>
          <p>{track ? track.artists.join(' / ') || '未知艺人' : '搜索喜欢的音乐，或粘贴单曲和歌单链接。'}</p>
          {track && <a href={track.externalUrl} target="_blank" rel="noreferrer" className={styles.trackLink}>在 {musicProviders.find((source) => source.id === track.ref.provider)?.name ?? track.ref.provider} 打开<OpenIn size="S" /></a>}
        </div>
      </section>
      {state.error && <InlineAlert variant="negative" fillStyle="subtleFill" className={styles.alert}>{state.error}</InlineAlert>}
      <PlayerControls />
      {(track && currentProvider?.capabilities.recommendations.state === 'available' || currentLyrics?.text) && (
        <div className={styles.extras}>
          {track && currentProvider?.capabilities.recommendations.state === 'available' && <ActionButton size="S" disabled={busy} onClick={() => void related()}>发现相似歌曲</ActionButton>}
          {currentLyrics?.text && <details className={styles.lyrics}><summary><UiIcon glyph="chevron" className={styles.chevron} />歌词</summary><p>{currentLyrics.text}</p>{currentLyrics.attribution && <small>{currentLyrics.attribution}</small>}</details>}
        </div>
      )}
      <div className={styles.tabs}>
        <div role="tablist" aria-label="曲目" className={tabs.list} data-density="compact">
          <button type="button" role="tab" aria-selected={tab === 'queue'} className={tabs.tab} onClick={() => setTab('queue')}>队列<span className={styles.count}>{state.queue.length}</span></button>
          <button type="button" role="tab" aria-selected={tab === 'results'} className={tabs.tab} onClick={() => setTab('results')}>查找结果{results && <span className={styles.count}>{results.tracks.length}</span>}</button>
        </div>
        <div className={styles.tabActions}>
          {tab === 'queue' && state.queue.length > 0 && <ActionButton size="S" quiet onClick={() => music.clear()}>清空</ActionButton>}
          {tab === 'results' && shown.length > 0 && <ActionButton size="S" quiet icon={Add} onClick={() => { music.add(shown); setTab('queue') }}>全部加入</ActionButton>}
        </div>
      </div>
      <div className={styles.content}>
        {message && <InlineAlert variant="neutral" fillStyle="subtleFill" className={styles.notice}>{message}</InlineAlert>}
        {shown.length === 0 ? <div className={styles.empty}>{busy ? <ProgressCircle size="M" label="正在查找音乐" /> : <MusicNote className={styles.emptyIcon} />}<p>{busy ? '正在查找音乐…' : tab === 'queue' ? '播放队列还是空的' : results ? '没有找到内容，试试其他关键词或链接' : '搜索歌名，或粘贴音乐链接'}</p></div> : <ul className={styles.list}>
          {shown.map((item, index) => <TrackRow key={`${trackKey(item)}:${index}`} track={item} active={!!track && trackKey(item) === trackKey(track)} queued={queued.has(trackKey(item))} queue={tab === 'queue'} playable={musicProviders.find(source => source.id === item.ref.provider)?.capabilities.playback.state === 'available'} onPlay={() => tab === 'queue' ? void music.select(index) : music.add([item], true)} onAction={() => tab === 'queue' ? music.remove(index) : music.add([item])} />)}
        </ul>}
        {tab === 'results' && results?.nextPage && <Button variant="secondary" className={styles.loadMore} disabled={busy} onClick={() => void search(true)}>{busy ? '加载中…' : '加载更多'}</Button>}
      </div>
      <footer className={styles.footer}><span>{state.queue.length >= 500 ? '队列已满（500 首）' : queueStatus}</span><PlaybackInspector engine={state.embedEngine} /></footer>
    </div>
  )
}

function TrackRow({ track, active, queued, queue, playable, onPlay, onAction }: { track: Track; active: boolean; queued: boolean; queue: boolean; playable: boolean; onPlay(): void; onAction(): void }) {
  return (
    <li className={styles.row} data-selected={active}>
      <button type="button" className={styles.rowTrack} disabled={!playable} onClick={onPlay} title={`播放 ${track.title}`}>
        <span className={styles.thumb}>{track.artworkUrl ? <img src={track.artworkUrl} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <MusicNote size="S" />}</span>
        <span className={styles.rowInfo}><span className={styles.rowTitle}>{track.title}</span><span className={styles.rowDescription}>{track.artists.join(' / ') || '未知艺人'}</span></span>
      </button>
      <IconButton
        size="S" icon={queue ? Close : queued ? Checkmark : Add}
        label={queue ? `移除 ${track.title}` : queued ? '已在队列中' : `加入队列 ${track.title}`} title={queue ? '移除' : queued ? '已在队列中' : '加入队列'}
        disabled={!queue && queued} onClick={onAction}
      />
    </li>
  )
}

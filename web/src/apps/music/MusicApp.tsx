import { Badge, Button, Callout, Card, Heading, Link, Tabs, Text, TextField } from '@radix-ui/themes'
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
import { Alert } from '../../ui/Alert.tsx'
import { IconButton } from '../../ui/IconButton.tsx'
import { ArrowTopRightIcon, CheckIcon, ChevronRightIcon, Cross2Icon, DiscIcon, GearIcon, InfoCircledIcon, MagnifyingGlassIcon, MusicIcon, PlusIcon } from '../../ui/icons.ts'
import { Select } from '../../ui/Select.tsx'
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
  if (!provider) return <div className={styles.empty}><Text as="p" size="2" color="gray">{providersError ?? '正在读取音乐来源…'}</Text>{providersError && <Button type="button" variant="soft" color="gray" onClick={() => void refreshProviders()}>重试</Button>}</div>
  const operation = inputOperation(provider, query.trim())
  const resolving = operation !== 'search'
  const queryCapability = provider.capabilities[operation]

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <span className={styles.brand}><MusicIcon width={18} height={18} /><Heading as="h2" size="4">音乐</Heading></span>
        {musicProviders.length > 1 ? <Select label="音乐来源" value={provider.id} options={musicProviders.map((source) => ({ value: source.id, label: source.name }))} onValueChange={(value) => { request.current?.abort(); setBusy(false); setResults(undefined); setMessage(''); setProviderId(value) }} /> : <Text size="1" color="gray">{provider.name}</Text>}
        {provider.configuration.fields.length > 0 && <IconButton icon={GearIcon} label="音乐设置" variant={settings ? 'soft' : 'ghost'} aria-expanded={settings} onClick={() => setSettings(!settings)} />}
      </header>
      <div className={styles.body}>
        {settings && <ProviderSettings key={provider.id} provider={provider} />}
        <Text as="p" size="1" color="gray">{provider.description}</Text>
        {providersError && <Notice>{providersError}</Notice>}
        <form className={styles.search} onSubmit={(event) => { event.preventDefault(); void search() }}>
          <TextField.Root className={styles.searchField} aria-label="搜索音乐或粘贴链接" placeholder="歌名、歌手或音乐链接" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={500}>
            <TextField.Slot><MagnifyingGlassIcon /></TextField.Slot>
          </TextField.Root>
          <Button type="submit" disabled={!query.trim() || queryCapability.state !== 'available'}>查找</Button>
        </form>
        {queryCapability.state === 'configuration-required' && <Text as="p" size="1" color="gray">{queryCapability.reason}</Text>}
        {queryCapability.state === 'unsupported' && <Text as="p" size="1" color="gray">此来源不支持{resolving ? '链接导入' : '搜索'}。</Text>}
        <Card asChild size="2">
          <section className={styles.nowPlaying} aria-label="正在播放">
            <span className={styles.artwork}>{track?.artworkUrl ? <img src={track.artworkUrl} alt="" referrerPolicy="no-referrer" /> : <DiscIcon width={40} height={40} />}</span>
            <div className={styles.trackInfo}>
              <Text as="span" size="1" color="gray">{state.status === 'playing' ? '正在播放' : state.status === 'loading' ? '正在连接…' : state.status === 'error' ? '播放遇到问题' : track ? '随时继续' : '你的音乐，随时播放'}</Text>
              <Heading as="h1" size="5" className={styles.trackTitle}>{track?.title ?? '从喜欢的一首开始'}</Heading>
              <Text as="p" size="2" color="gray">{track ? track.artists.join(' / ') || '未知艺人' : '搜索喜欢的音乐，或粘贴单曲和歌单链接。'}</Text>
              {track && <Link size="1" href={track.externalUrl} target="_blank" rel="noreferrer" className={styles.trackLink}>在 {musicProviders.find((source) => source.id === track.ref.provider)?.name ?? track.ref.provider} 打开 <ArrowTopRightIcon /></Link>}
            </div>
          </section>
        </Card>
        {state.error && <Alert>{state.error}</Alert>}
      </div>
      <PlayerControls />
      {(track && currentProvider?.capabilities.recommendations.state === 'available' || currentLyrics?.text) && (
        <div className={styles.extras}>
          {track && currentProvider?.capabilities.recommendations.state === 'available' && <Button type="button" size="1" variant="soft" color="gray" disabled={busy} onClick={() => void related()}>发现相似歌曲</Button>}
          {currentLyrics?.text && <details className={styles.lyrics}><summary><ChevronRightIcon />歌词</summary><Text as="p" size="2" color="gray">{currentLyrics.text}</Text>{currentLyrics.attribution && <Text as="p" size="1" color="gray">{currentLyrics.attribution}</Text>}</details>}
        </div>
      )}
      <Tabs.Root value={tab} onValueChange={(value) => setTab(value as 'queue' | 'results')} className={styles.tabs}>
        <div className={styles.tabBar}>
          <Tabs.List size="2" className={styles.tabList}>
            <Tabs.Trigger value="queue">队列<Badge size="1" color="gray" className={styles.count}>{state.queue.length}</Badge></Tabs.Trigger>
            <Tabs.Trigger value="results">查找结果{results && <Badge size="1" color="gray" className={styles.count}>{results.tracks.length}</Badge>}</Tabs.Trigger>
          </Tabs.List>
          {tab === 'queue' && state.queue.length > 0 && <Button type="button" size="1" variant="ghost" color="gray" onClick={() => music.clear()}>清空</Button>}
          {tab === 'results' && shown.length > 0 && <Button type="button" size="1" variant="ghost" color="gray" onClick={() => { music.add(shown); setTab('queue') }}>全部加入</Button>}
        </div>
        <Tabs.Content value={tab} className={styles.content}>
          {message && <Notice>{message}</Notice>}
          {shown.length === 0 ? <div className={styles.empty}><DiscIcon width={32} height={32} /><Text as="p" size="2" color="gray">{busy ? '正在查找音乐…' : tab === 'queue' ? '播放队列还是空的' : results ? '没有找到内容，试试其他关键词或链接' : '搜索歌名，或粘贴音乐链接'}</Text></div> : <ul className={styles.list}>
            {shown.map((item, index) => <TrackRow key={`${trackKey(item)}:${index}`} track={item} active={!!track && trackKey(item) === trackKey(track)} queued={queued.has(trackKey(item))} queue={tab === 'queue'} playable={musicProviders.find(source => source.id === item.ref.provider)?.capabilities.playback.state === 'available'} onPlay={() => tab === 'queue' ? void music.select(index) : music.add([item], true)} onAction={() => tab === 'queue' ? music.remove(index) : music.add([item])} />)}
          </ul>}
          {tab === 'results' && results?.nextPage && <Button type="button" variant="soft" color="gray" className={styles.loadMore} loading={busy} onClick={() => void search(true)}>加载更多</Button>}
        </Tabs.Content>
      </Tabs.Root>
      <footer className={styles.footer}><Text size="1" color="gray">{state.queue.length >= 500 ? '队列已满（500 首）' : queueStatus}</Text><PlaybackInspector engine={state.embedEngine} /></footer>
    </div>
  )
}

function Notice({ children }: { children: string }) {
  return (
    <Callout.Root size="1" color="gray" variant="soft" role="status">
      <Callout.Icon><InfoCircledIcon /></Callout.Icon>
      <Callout.Text className={styles.noticeText}>{children}</Callout.Text>
    </Callout.Root>
  )
}

function TrackRow({ track, active, queued, queue, playable, onPlay, onAction }: { track: Track; active: boolean; queued: boolean; queue: boolean; playable: boolean; onPlay(): void; onAction(): void }) {
  return (
    <li className={styles.row} data-active={active}>
      <button type="button" className={styles.rowTrack} disabled={!playable} onClick={onPlay} title={`播放 ${track.title}`}>
        <span className={styles.thumb}>{track.artworkUrl ? <img src={track.artworkUrl} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <MusicIcon />}</span>
        <span className={styles.rowInfo}><span className={styles.rowTitle}>{track.title}</span><span className={styles.rowArtists}>{track.artists.join(' / ') || '未知艺人'}</span></span>
      </button>
      <IconButton icon={queue ? Cross2Icon : queued ? CheckIcon : PlusIcon} label={queue ? `移除 ${track.title}` : queued ? '已在队列中' : `加入队列 ${track.title}`} title={queue ? '移除' : queued ? '已在队列中' : '加入队列'} disabled={!queue && queued} className={styles.rowAction} onClick={onAction} />
    </li>
  )
}

import type { CatalogPage, MusicErrorCode, Track } from './types.js'

export class MusicError extends Error {
  code: MusicErrorCode
  constructor(message: string, code: MusicErrorCode) { super(message); this.code = code }
}

export function parseYouTubeInput(input: string): { kind: 'track' | 'playlist'; id: string } | undefined {
  const value = input.trim()
  if (/^[\w-]{11}$/.test(value)) return { kind: 'track', id: value }
  let url: URL
  try { url = new URL(value) } catch { return undefined }
  if (!['https:', 'http:'].includes(url.protocol) || url.port || url.username || url.password) return undefined
  if (!['youtube.com', 'www.youtube.com', 'music.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtu.be'].includes(url.hostname)) return undefined
  const id = url.hostname.endsWith('youtu.be') ? url.pathname.slice(1) : url.searchParams.get('v') ?? url.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]+)\/?$/)?.[1]
  if (id && /^[\w-]{11}$/.test(id)) return { kind: 'track', id }
  const list = url.searchParams.get('list')
  if (list && /^[\w-]{10,100}$/.test(list)) return { kind: 'playlist', id: list }
  return undefined
}

const track = (id: string, title: string, artist = '', artworkUrl?: string): Track => ({
  ref: { provider: 'youtube', id }, title, artists: artist ? [artist] : [],
  artworkUrl: artworkUrl ?? `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
  externalUrl: `https://www.youtube.com/watch?v=${id}`,
})

type Item = { id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string; videoOwnerChannelTitle?: string; resourceId?: { videoId?: string }; thumbnails?: { medium?: { url: string } } } }
type Data = { items?: Item[]; nextPageToken?: string; error?: { errors?: { reason?: string }[] } }

async function request(endpoint: string, key: string, params: Record<string, string>): Promise<Data> {
  if (!key) throw new MusicError('按名称搜索和导入歌单需要先设置 YouTube 搜索密钥。单曲链接可以直接添加。', 'configuration')
  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`)
  url.search = new URLSearchParams(params).toString()
  let res: Response
  try {
    res = await fetch(url, { headers: { 'X-Goog-Api-Key': key }, signal: AbortSignal.timeout(10_000) })
  } catch { throw new MusicError('无法连接 YouTube，请稍后重试。', 'network') }
  const data = await res.json().catch(() => ({})) as Data
  if (!res.ok) {
    const reason = data.error?.errors?.[0]?.reason
    if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded' || res.status === 429) throw new MusicError('YouTube 请求额度已用完，请稍后重试。', 'quota')
    if (res.status === 400 || res.status === 401 || res.status === 403) throw new MusicError('YouTube 拒绝了请求，请检查密钥、API 启用状态和访问限制。', 'configuration')
    throw new MusicError('无法读取 YouTube 内容，内容可能已删除或未公开。', 'unavailable')
  }
  return data
}

function page(data: Data): CatalogPage {
  return {
    tracks: (data.items ?? []).flatMap((item) => {
      const snippet = item.snippet
      const id = item.id?.videoId ?? snippet?.resourceId?.videoId
      if (!id || !/^[\w-]{11}$/.test(id) || !snippet?.title || ['Private video', 'Deleted video'].includes(snippet.title)) return []
      return [track(id, snippet.title, snippet.videoOwnerChannelTitle ?? snippet.channelTitle, snippet.thumbnails?.medium?.url)]
    }),
    nextPage: data.nextPageToken,
  }
}

export const youtubeCatalog = {
  async search(query: string, key: string, nextPage?: string): Promise<CatalogPage> {
    return page(await request('search', key, {
      part: 'snippet', type: 'video', q: query, maxResults: '20', videoEmbeddable: 'true',
      ...(nextPage ? { pageToken: nextPage } : {}),
    }))
  },
  async resolve(input: string, key: string, nextPage?: string): Promise<CatalogPage> {
    const ref = parseYouTubeInput(input)
    if (!ref) throw new MusicError('请输入有效的 YouTube 或 YouTube Music 单曲、视频或公开歌单链接。', 'invalid-input')
    if (ref.kind === 'playlist') return page(await request('playlistItems', key, {
      part: 'snippet', playlistId: ref.id, maxResults: '50', ...(nextPage ? { pageToken: nextPage } : {}),
    }))
    try {
      const url = new URL('https://www.youtube.com/oembed')
      url.search = new URLSearchParams({ url: `https://www.youtube.com/watch?v=${ref.id}`, format: 'json' }).toString()
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) })
      if (response.status === 404 || response.status === 401) throw new MusicError('这首内容未公开、已删除或不可嵌入播放。', 'unavailable')
      if (!response.ok) throw new Error('metadata')
      const data = await response.json() as { title: string; author_name: string; thumbnail_url?: string }
      if (typeof data.title !== 'string') throw new Error('metadata')
      return { tracks: [track(ref.id, data.title, data.author_name, data.thumbnail_url)] }
    } catch (error) {
      if (error instanceof MusicError) throw error
      return { tracks: [track(ref.id, `YouTube · ${ref.id}`)], warning: '暂时无法读取曲目信息，仍可尝试播放。' }
    }
  },
}

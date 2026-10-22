import { Hono } from 'hono'
import { validator } from 'hono/validator'
import { notifyChange } from '../../events.js'
import type { MusicApiError } from './types.js'
import { mutateQueue, readQueue } from './queue.js'
import { MusicError, requireCapability, type MusicProvider } from './provider.js'
import { youtubeOfficial } from './youtubeOfficial.js'
import { youtubeMusic } from './youtubeMusic.js'

export function createMusicApi(adapters: MusicProvider[]) {
  const providers = new Map(adapters.map(provider => [provider.info().id, provider]))
  const getProvider = (id: string) => {
    const provider = providers.get(id)
    if (!provider) throw new MusicError('这个音乐来源暂不可用。', 'unsupported')
    return provider
  }
  return new Hono()
    .use('*', async (c, next) => { c.header('Cache-Control', 'no-store'); await next() })
    .onError((error, c) => {
      if (error instanceof MusicError) return c.json({ error: error.message, code: error.code } satisfies MusicApiError, error.code === 'invalid-input' ? 400 : error.code === 'unsupported' ? 422 : error.code === 'configuration' ? 409 : error.code === 'quota' ? 429 : 502)
      return c.json({ error: '音乐来源暂时无法完成请求，请稍后重试或检查连接设置。', code: 'unavailable' } satisfies MusicApiError, 502)
    })
    .get('/queue', (c) => c.json(readQueue()))
    .post('/queue', async (c) => c.json(mutateQueue(await c.req.json().catch(() => null))))
    .get('/providers', (c) => c.json({ providers: adapters.map(provider => provider.info()) }))
    .put('/providers/:provider/settings', validator('json', (value: unknown) => value), async (c) => {
      const provider = getProvider(c.req.param('provider'))
      if (!provider.configure) throw new MusicError('这个音乐来源没有可配置的连接参数。', 'unsupported')
      const body = c.req.valid('json')
      const fields = provider.info().configuration.fields
      if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.keys(body).length || Object.entries(body).some(([key, value]) => !fields.some(field => field.id === key) || typeof value !== 'string' || value.length > 16000 || /[\r\n\0]/.test(value))) throw new MusicError('连接参数无效，请检查后重试。', 'invalid-input')
      provider.configure(body as Record<string, string>)
      notifyChange({ type: 'music' })
      return c.json(provider.info())
    })
    .get('/providers/:provider/stream', async (c) => {
      const provider = getProvider(c.req.param('provider'))
      requireCapability(provider, 'playback')
      if (!provider.stream) throw new MusicError('此来源不支持音频流传输。', 'unsupported')
      return provider.stream(c.req.query('id') ?? '', c.req.header('range'), c.req.raw.signal)
    })
    .get('/providers/:provider/:operation', validator('query', (value) => {
      const query = typeof value.q === 'string' ? value.q.trim() : ''
      const page = typeof value.page === 'string' ? value.page : undefined
      if (!query || query.length > 500 || (page && (page.length > 300 || !/^[\w=-]+$/.test(page)))) throw new MusicError('请输入有效的查询内容。', 'invalid-input')
      return { q: query, page }
    }), async (c) => {
      const provider = getProvider(c.req.param('provider'))
      const operation = c.req.param('operation')
      const { q, page } = c.req.valid('query')
      if (operation === 'playback') {
        requireCapability(provider, 'playback')
        if (!provider.playback) throw new MusicError('此来源未提供播放能力。', 'unsupported')
        return c.json(await provider.playback({ provider: provider.info().id, id: q }))
      }
      if (operation === 'lyrics') {
        requireCapability(provider, 'lyrics')
        if (!provider.lyrics) throw new MusicError('此来源未提供歌词能力。', 'unsupported')
        return c.json(await provider.lyrics(q))
      }
      if (operation !== 'search' && operation !== 'resolve' && operation !== 'recommendations') return c.notFound()
      requireCapability(provider, operation)
      const method = provider[operation]
      if (!method) throw new MusicError('此来源未提供这项曲库能力。', 'unsupported')
      return c.json(await method(q, page))
    })
}
export const musicApi = createMusicApi([youtubeMusic, youtubeOfficial])
export type MusicApi = typeof musicApi

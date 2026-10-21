import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { Hono } from 'hono'
import { validator } from 'hono/validator'
import { appDir } from '../../paths.js'
import type { CatalogPage, MusicApiError } from './types.js'
import { mutateQueue, readQueue } from './queue.js'
import { MusicError, youtubeCatalog } from './youtube.js'

interface CatalogProvider {
  search(query: string, page?: string): Promise<CatalogPage>
  resolve(input: string, page?: string): Promise<CatalogPage>
}

const providers: Record<string, CatalogProvider | undefined> = {
  youtube: {
    search: (query, page) => youtubeCatalog.search(query, apiKey(), page),
    resolve: (input, page) => youtubeCatalog.resolve(input, apiKey(), page),
  },
}
const settingsFile = () => path.join(appDir('music'), 'settings.json')
function apiKey(): string {
  try {
    const data = JSON.parse(readFileSync(settingsFile(), 'utf8')) as { youtubeApiKey?: unknown }
    return typeof data.youtubeApiKey === 'string' ? data.youtubeApiKey : ''
  } catch { return '' }
}

export const musicApi = new Hono()
  .use('*', async (c, next) => { c.header('Cache-Control', 'no-store'); await next() })
  .onError((error, c) => {
    if (error instanceof MusicError) return c.json({ error: error.message, code: error.code } satisfies MusicApiError, error.code === 'invalid-input' ? 400 : error.code === 'configuration' ? 409 : error.code === 'quota' ? 429 : 502)
    return c.json({ error: '音乐服务暂时不可用，请稍后重试。', code: 'unavailable' } satisfies MusicApiError, 500)
  })
  .get('/queue', (c) => c.json(readQueue()))
  .post('/queue', async (c) => c.json(mutateQueue(await c.req.json().catch(() => null))))
  .get('/settings', (c) => c.json({ youtubeConfigured: Boolean(apiKey()) }))
  .put('/settings', async (c) => {
    const body: unknown = await c.req.json().catch(() => null)
    const key = (body as { youtubeApiKey?: unknown } | null)?.youtubeApiKey
    if (typeof key !== 'string' || key.length > 256 || /\s/.test(key)) return c.json({ error: '请输入有效的搜索密钥。', code: 'invalid-input' } satisfies MusicApiError, 400)
    mkdirSync(appDir('music'), { recursive: true })
    const file = settingsFile()
    writeFileSync(`${file}.tmp`, JSON.stringify({ youtubeApiKey: key }) + '\n', { mode: 0o600 })
    renameSync(`${file}.tmp`, file)
    return c.json({ youtubeConfigured: Boolean(key) })
  })
  .get('/providers/:provider/:operation', validator('query', (value) => {
    const query = typeof value.q === 'string' ? value.q.trim() : ''
    const page = typeof value.page === 'string' ? value.page : undefined
    if (!query || query.length > 500 || (page && (page.length > 300 || !/^[\w=-]+$/.test(page)))) throw new MusicError('请输入歌名、歌手或链接。', 'invalid-input')
    return { q: query, page }
  }), async (c) => {
    const provider = providers[c.req.param('provider')]
    const operation = c.req.param('operation')
    if (!provider || (operation !== 'search' && operation !== 'resolve')) return c.notFound()
    const { q, page } = c.req.valid('query')
    return c.json(await provider[operation](q, page))
  })

export type MusicApi = typeof musicApi

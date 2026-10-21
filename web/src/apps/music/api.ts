import type { MusicApi } from '@binos/server/apps/music/api'
import type { CatalogPage, MusicApiError } from '@binos/server/apps/music/types'
import { hc } from 'hono/client'

const client = hc<MusicApi>(`${window.location.origin}/api/apps/music`)
async function json<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const data = await response.json().catch(() => null) as MusicApiError | null
    throw new Error(data?.error ?? '音乐服务暂时不可用。')
  }
  return response.json() as Promise<T>
}

export async function catalog(provider: string, operation: 'search' | 'resolve', query: string, page?: string, signal?: AbortSignal) {
  const response = await client.providers[':provider'][':operation'].$get({ param: { provider, operation }, query: { q: query, page } }, { init: { signal } })
  return json<CatalogPage>(response)
}

export async function readMusicSettings() { return json<{ youtubeConfigured: boolean }>(await client.settings.$get()) }
export async function saveYouTubeKey(youtubeApiKey: string) { return json<{ youtubeConfigured: boolean }>(await client.settings.$put({ json: { youtubeApiKey } })) }

export async function readQueue() { return json<import('@binos/server/apps/music/types').QueueSnapshot>(await client.queue.$get()) }
export async function mutateQueue(mutation: import('@binos/server/apps/music/types').QueueMutation) {
  return json<import('@binos/server/apps/music/types').QueueSnapshot>(await client.queue.$post({ json: mutation }))
}

import type { AppType } from '@binos/server/api'
import type { AppRegistry } from '@binos/server/types'
import { hc } from 'hono/client'

const client = hc<AppType>(window.location.origin)

export async function getVersion(): Promise<string | undefined> {
  const res = await client.api.health.$get().catch(() => undefined)
  return res?.ok ? (await res.json()).version : undefined
}

export function eventsUrl() {
  return client.api.events.$url().href
}

// 读不到时返回 undefined
export async function readRegistry(): Promise<AppRegistry | undefined> {
  const res = await client.api.apps.$get().catch(() => undefined)
  return res?.ok ? await res.json() : undefined
}

// 返回是否写入成功
export async function writeRegistry(registry: AppRegistry): Promise<boolean> {
  const res = await client.api.apps.$put({ json: registry }).catch(() => undefined)
  return res?.ok ?? false
}

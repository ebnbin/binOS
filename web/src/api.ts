import type { AppType } from '@binos/server/api'
import type { StateChange, StateEntry } from '@binos/server/types'
import { hc } from 'hono/client'

const client = hc<AppType>(window.location.origin)

export async function getVersion(): Promise<string | undefined> {
  const res = await client.api.health.$get().catch(() => undefined)
  return res?.ok ? (await res.json()).version : undefined
}

export function eventsUrl() {
  return client.api.events.$url().href
}

export async function readState(): Promise<{ version: number; entries: StateEntry[] }> {
  const res = await client.api.state.$get()
  if (!res.ok) {
    throw new Error(`读取系统状态失败（${res.status}）`)
  }
  return await res.json()
}

// 返回这组改动的版本号，失败时返回 undefined
export async function writeState(changes: StateChange[]): Promise<number | undefined> {
  const res = await client.api.state.$post({ json: { changes } }).catch(() => undefined)
  return res?.ok ? (await res.json()).version : undefined
}

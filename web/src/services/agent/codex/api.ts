import type { CodexApi } from '@binos/server/services/agent/drivers/codex/api'
import { hc } from 'hono/client'

const client = hc<CodexApi>(`${window.location.origin}/api/agent/codex`)

// 在网页上重新登录 Codex（设备码登录）：拿到网址和码，用户去授权，页面轮询结果
export async function startCodexLogin(): Promise<{ id: string; url: string; code: string } | { error: string }> {
  const res = await client.login.$post({}, { headers: { 'Content-Type': 'application/json' } }).catch(() => undefined)
  return res ? await res.json() : { error: '网络错误' }
}

export async function codexLoginStatus(id: string): Promise<{ status: 'waiting' | 'done' } | { status: 'failed'; error: string } | undefined> {
  const res = await client.login[':id'].$get({ param: { id } }).catch(() => undefined)
  return res?.ok ? await res.json() : undefined
}

export async function cancelCodexLogin(id: string) {
  await client.login[':id'].cancel.$post({ param: { id } }, { headers: { 'Content-Type': 'application/json' } }).catch(() => undefined)
}

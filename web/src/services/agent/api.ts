import type { AgentApi } from '@binos/server/services/agent/api'
import { hc } from 'hono/client'

const client = hc<AgentApi>(`${window.location.origin}/api/agent`)

// 各个 agent 的账号、登录凭证和用量；读不到时返回 undefined
export async function agentAccounts() {
  const res = await client.accounts.$get().catch(() => undefined)
  return res?.ok ? (await res.json()).accounts : undefined
}

// 读不到时当作不能用
export async function codexCatalog() {
  const res = await client.codex.$get().catch(() => undefined)
  return res?.ok ? await res.json() : { available: false, models: [] }
}

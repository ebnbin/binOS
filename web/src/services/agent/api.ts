import type { AgentApi } from '@binos/server/services/agent/api'
import { hc } from 'hono/client'

const client = hc<AgentApi>(`${window.location.origin}/api/agent`)

// 各个 agent 的账号、登录凭证和用量；读不到时返回 undefined
export async function agentAccounts() {
  const res = await client.accounts.$get().catch(() => undefined)
  return res?.ok ? (await res.json()).accounts : undefined
}

// 各个 agent 能不能用、有哪些模型；读不到时返回空列表
export async function agentCatalogs() {
  const res = await client.agents.$get().catch(() => undefined)
  return res?.ok ? (await res.json()).agents : []
}

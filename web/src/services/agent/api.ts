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

export type ClaudeLoginKind = 'login' | 'token'

// 在网页上登录 Claude：先拿到授权链接，用户授权后把代码贴回来
export async function startClaudeLogin(kind: ClaudeLoginKind): Promise<{ id: string; url: string } | { error: string }> {
  const res = await client.claude.login.$post({ json: { kind } }).catch(() => undefined)
  return res ? await res.json() : { error: '网络错误' }
}

export async function finishClaudeLogin(id: string, code: string): Promise<{ ok: true } | { error: string }> {
  const res = await client.claude.login[':id'].$post({ param: { id }, json: { code } }).catch(() => undefined)
  return res ? await res.json() : { error: '网络错误' }
}

export async function cancelClaudeLogin(id: string) {
  await client.claude.login[':id'].cancel.$post({ param: { id } }, { headers: { 'Content-Type': 'application/json' } }).catch(() => undefined)
}

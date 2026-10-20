import type { AgentApi } from '@binos/server/services/agent/api'
import { hc } from 'hono/client'

const client = hc<AgentApi>(`${window.location.origin}/api/agent`)

// 各个 agent 最近报告的额度和登录的状况；读不到时返回 undefined
export async function agentStatus() {
  const res = await client.status.$get().catch(() => undefined)
  return res?.ok ? await res.json() : undefined
}

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

// thread 的内容：from 之后的条目，以及临时内容的变化
export function threadStreamUrl(thread: string, from: number) {
  const url = client.threads[':id'].stream.$url({ param: { id: thread } })
  url.searchParams.set('from', String(from))
  return url.href
}

// name：下载时用的文件名
export function threadFileUrl(thread: string, file: string, name?: string) {
  const url = client.threads[':id'].files[':file'].$url({ param: { id: thread, file } })
  if (name) {
    url.searchParams.set('name', name)
  }
  return url.pathname + url.search
}

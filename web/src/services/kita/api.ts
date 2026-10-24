import type { KitaApi } from '@binos/server/services/kita/api'
import { hc } from 'hono/client'

const client = hc<KitaApi>(`${window.location.origin}/api/kita`)

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
export function sessionStreamUrl(thread: string, from: number) {
  const url = client.sessions[':id'].stream.$url({ param: { id: thread } })
  url.searchParams.set('from', String(from))
  return url.href
}

// name：下载时用的文件名
export function sessionFileUrl(thread: string, file: string, name?: string) {
  const url = client.sessions[':id'].files[':file'].$url({ param: { id: thread, file } })
  if (name) {
    url.searchParams.set('name', name)
  }
  return url.pathname + url.search
}

// 写操作都要带上 JSON 的 Content-Type，后端以此拒绝跨站请求
const jsonHeaders = { headers: { 'Content-Type': 'application/json' } }

// 各个 app 正在回答的 session；读不到时返回 undefined
export async function kitaActivity() {
  const res = await client.activity.$get().catch(() => undefined)
  return res?.ok ? (await res.json()).activity : undefined
}

export async function readProfile() {
  const res = await client.profile.$get()
  if (!res.ok) throw new Error('读取喜多的资料失败')
  return (await res.json()).profile
}

export async function saveDescription(description: string) {
  const res = await client.profile.description.$post({ json: { description } }).catch(() => undefined)
  return res?.ok ?? false
}

export const photoUrl = (file: string) => client.profile.photos[':file'].$url({ param: { file } }).pathname

export async function uploadPhoto(file: File): Promise<string | undefined> {
  const res = await fetch(client.profile.photos.$url(), {
    method: 'POST',
    body: file,
    headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) },
  }).catch(() => undefined)
  if (res?.ok) return undefined
  const body = (await res?.json().catch(() => undefined)) as { error?: string } | undefined
  return body?.error ?? `上传 ${file.name} 失败（${res?.status ?? '网络错误'}）`
}

export async function removePhoto(file: string) {
  await client.profile.photos[':file'].delete.$post({ param: { file } }, jsonHeaders).catch(() => undefined)
}

export async function setAvatar(file: string) {
  await client.profile.photos[':file'].avatar.$post({ param: { file } }, jsonHeaders).catch(() => undefined)
}

export async function listMemories() {
  const res = await client.memories.$get()
  if (!res.ok) throw new Error('读取记忆失败')
  return (await res.json()).memories
}

export async function addMemory(text: string) {
  const res = await client.memories.$post({ json: { text } }).catch(() => undefined)
  return res?.ok ?? false
}

export async function updateMemory(id: string, change: { text?: string; kind?: 'stated' | 'inferred' }) {
  const res = await client.memories[':id'].$post({ param: { id }, json: change }).catch(() => undefined)
  return res?.ok ?? false
}

export async function removeMemory(id: string) {
  await client.memories[':id'].delete.$post({ param: { id }, json: {} }).catch(() => undefined)
}

export async function revertMemory(id: string) {
  await client.memories[':id'].revert.$post({ param: { id }, json: {} }).catch(() => undefined)
}

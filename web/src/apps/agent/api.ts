import type { AgentApi } from '@binos/server/apps/agent/api'
import type { Attachment } from '@binos/server/apps/agent/types'
import { hc } from 'hono/client'

const client = hc<AgentApi>(`${window.location.origin}/api/apps/agent`)
const sessions = client.sessions

export async function listSessions() {
  const res = await sessions.$get()
  if (!res.ok) {
    throw new Error(`读取 session 列表失败（${res.status}）`)
  }
  return (await res.json()).sessions
}

// 正在回答时交给 agent，interrupt 时先打断正在做的事
export async function sendMessage(
  sessionId: number | null,
  text: string,
  attachments: Attachment[],
  interrupt = false,
): Promise<{ id: number } | { error: string }> {
  const json = { text, attachments, interrupt }
  const res = await (sessionId === null
    ? sessions.$post({ json })
    : sessions[':id'].messages.$post({ param: { id: String(sessionId) }, json })
  ).catch(() => undefined)
  if (res?.status === 200) {
    return await res.json()
  }
  return { error: res?.status === 503 ? '消息没能交给 agent，稍后再试' : `发送失败（${res?.status ?? '网络错误'}）` }
}

// 和后端一致
export const maxUploadBytes = 50 * 1024 * 1024

export async function uploadFile(file: File): Promise<Attachment | { error: string }> {
  const res = await fetch(client.uploads.$url(), {
    method: 'POST',
    body: file,
    headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) },
  }).catch(() => undefined)
  if (res?.ok) {
    const { file: name } = (await res.json()) as { file: string }
    return { file: name, name: file.name }
  }
  return { error: `上传 ${file.name} 失败（${res?.status === 413 ? '文件太大' : (res?.status ?? '网络错误')}）` }
}

// 写操作都要带上 JSON 的 Content-Type，后端以此拒绝跨站请求
export async function stopSession(sessionId: number) {
  await sessions[':id'].stop.$post({ param: { id: String(sessionId) } }, { headers: { 'Content-Type': 'application/json' } }).catch(() => undefined)
}

export function streamUrl(sessionId: number, from: number) {
  const url = sessions[':id'].stream.$url({ param: { id: String(sessionId) } })
  url.searchParams.set('from', String(from))
  return url.href
}

// name：下载时用的文件名
export function fileUrl(sessionId: number, file: string, name?: string) {
  const url = sessions[':id'].files[':file'].$url({ param: { id: String(sessionId), file } })
  if (name) {
    url.searchParams.set('name', name)
  }
  return url.pathname + url.search
}

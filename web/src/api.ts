import type { AppType } from '@binos/server/api'
import { hc } from 'hono/client'

// 后端接口的客户端，地址、参数和返回值的类型来自后端的路由定义
const client = hc<AppType>(window.location.origin)
const sessions = client.api.sessions

export async function listSessions() {
  const res = await sessions.$get()
  if (!res.ok) {
    throw new Error(`读取 session 列表失败（${res.status}）`)
  }
  return (await res.json()).sessions
}

// 发送一条消息，sessionId 为 null 时新建 session。成功返回 session 编号，失败返回原因
export async function sendMessage(sessionId: number | null, text: string): Promise<{ id: number } | { error: string }> {
  const res = await (sessionId === null
    ? sessions.$post({ json: { text } })
    : sessions[':id'].messages.$post({ param: { id: String(sessionId) }, json: { text } })
  ).catch(() => undefined)
  if (res?.status === 200) {
    return await res.json()
  }
  return { error: res?.status === 409 ? '这个 session 正在回答' : `发送失败（${res?.status ?? '网络错误'}）` }
}

// 写操作都要带上 JSON 的 Content-Type，后端以此拒绝跨站请求
export async function stopSession(sessionId: number) {
  await sessions[':id'].stop.$post({ param: { id: String(sessionId) } }, { headers: { 'Content-Type': 'application/json' } }).catch(() => undefined)
}

// 实时推送的地址，从第 from 个条目开始补发
export function streamUrl(sessionId: number, from: number) {
  const url = sessions[':id'].stream.$url({ param: { id: String(sessionId) } })
  url.searchParams.set('from', String(from))
  return url.href
}

export function fileUrl(sessionId: number, file: string) {
  return sessions[':id'].files[':file'].$url({ param: { id: String(sessionId), file } }).pathname
}

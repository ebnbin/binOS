import type { BrowserApi } from '@binos/server/apps/browser/api'
import type { InputEvent, TabAction, Viewport } from '@binos/server/apps/browser/types'
import { hc } from 'hono/client'

const client = hc<BrowserApi>(`${window.location.origin}/api/apps/browser`)

export const streamUrl = () => client.stream.$url().href

// 操作失败了也没有可以补救的；连不上 Chrome 的原因由 stream 推送
// 写操作都要带上 JSON 的 Content-Type，后端以此拒绝跨站请求
export async function reconnect() {
  await client.connect.$post({}, { headers: { 'Content-Type': 'application/json' } }).catch(() => undefined)
}

export async function setViewport(viewport: Viewport) {
  await client.viewport.$post({ json: viewport }).catch(() => undefined)
}

export async function navigate(url: string) {
  await client.navigate.$post({ json: { url } }).catch(() => undefined)
}

export async function runAction(action: TabAction) {
  await client.action.$post({ json: { action } }).catch(() => undefined)
}

export async function sendInput(events: InputEvent[]) {
  await client.input.$post({ json: { events } }).catch(() => undefined)
}

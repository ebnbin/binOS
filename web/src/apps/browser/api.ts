import type { BrowserApi } from '@binos/server/apps/browser/api'
import type { InputEvent, TabAction, Viewport } from '@binos/server/apps/browser/types'
import { hc } from 'hono/client'

const client = hc<BrowserApi>(`${window.location.origin}/api/apps/browser`)

export const streamUrl = () => client.stream.$url().href

// 浏览器的操作失败了也没有可以补救的，下一次操作会重新启动它
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

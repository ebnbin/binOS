import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright-core'
import type { Browser, BrowserContext } from 'playwright-core'

export function activePortEndpoint(value: string) {
  const [port, endpoint] = value.trim().split(/\r?\n/)
  if (!/^\d+$/.test(port ?? '') || Number(port) < 1 || Number(port) > 65535 || !/^\/devtools\/browser\/[\w-]+$/.test(endpoint ?? '')) {
    throw new Error('Chrome 远程调试地址无效')
  }
  return `ws://127.0.0.1:${port}${endpoint}`
}

let connection: Promise<Browser> | undefined

export async function chromeContext(): Promise<BrowserContext> {
  if (!connection) {
    const pending = (async () => {
      const endpoint = process.env.BINOS_BROWSER_CDP_ENDPOINT ?? activePortEndpoint(await readFile(path.join(homedir(), 'Library/Application Support/Google/Chrome/DevToolsActivePort'), 'utf8'))
      const browser = await chromium.connectOverCDP(endpoint, { noDefaults: true, timeout: 60000 })
      browser.on('disconnected', () => { if (connection === pending) connection = undefined })
      return browser
    })()
    connection = pending
  }
  const pending = connection
  try {
    const context = (await pending).contexts()[0]
    if (!context) throw new Error('Chrome 没有可用的个人资料')
    return context
  } catch {
    if (connection === pending) connection = undefined
    throw new Error('无法连接个人 Chrome。请在 Mac 上打开 Chrome，在 chrome://inspect/#remote-debugging 开启远程调试，并在连接弹窗中选择允许')
  }
}

export async function disconnectChrome() {
  const pending = connection
  connection = undefined
  // connectOverCDP 返回的 Browser.close 只断开连接；关闭默认 context 会退出用户的 Chrome。
  await pending?.then((browser) => browser.close()).catch(() => {})
}

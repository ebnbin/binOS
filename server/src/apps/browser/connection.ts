import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright-core'
import type { BrowserContext } from 'playwright-core'
import { rootFromEnv, rootLayout } from '../../layout.js'

type Connection = { context: BrowserContext; disconnect: () => Promise<void> }
let connection: Promise<Connection> | undefined

export async function chromeContext(): Promise<BrowserContext> {
  if (!connection) {
    const pending = (async (): Promise<Connection> => {
      const endpoint = process.env.BINOS_BROWSER_CDP_ENDPOINT
      if (endpoint) {
        const browser = await chromium.connectOverCDP(endpoint, { noDefaults: true, timeout: 60000 })
        browser.on('disconnected', () => { if (connection === pending) connection = undefined })
        const context = browser.contexts()[0]
        if (!context) { await browser.close(); throw new Error('Chrome 没有可用的个人资料') }
        // 外部连接只断开 CDP，不能关闭它的默认 context。
        return { context, disconnect: () => browser.close() }
      }
      const profile = path.join(rootLayout(rootFromEnv()).appsDir, 'browser', 'chrome')
      await mkdir(profile, { recursive: true, mode: 0o700 })
      const context = await chromium.launchPersistentContext(profile, {
        channel: 'chrome', headless: false, chromiumSandbox: true, viewport: null,
      })
      context.on('close', () => { if (connection === pending) connection = undefined })
      return { context, disconnect: () => context.close() }
    })()
    connection = pending
  }
  const pending = connection
  try {
    return (await pending).context
  } catch (error) {
    if (connection === pending) connection = undefined
    throw new Error(`无法启动远程浏览器：${error instanceof Error ? error.message : String(error)}`)
  }
}

export async function disconnectChrome() {
  const pending = connection
  connection = undefined
  await pending?.then(({ disconnect }) => disconnect()).catch(() => {})
}

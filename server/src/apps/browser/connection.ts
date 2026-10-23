import { execFile } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright-core'
import type { Browser, BrowserContext } from 'playwright-core'
import { relayDir } from './relay-path.js'

let connection: Promise<Browser> | undefined

export async function chromeContext(): Promise<BrowserContext> {
  if (!connection) {
    const pending = (async () => {
      const browser = process.env.BINOS_BROWSER_CDP_ENDPOINT
        ? await chromium.connectOverCDP(process.env.BINOS_BROWSER_CDP_ENDPOINT, { noDefaults: true, timeout: 60000 })
        : await connectRelay()
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
    throw new Error('个人 Chrome 的 binOS Browser 扩展尚未连接。请确认已完成扩展的一次性安装，并打开 Chrome。')
  }
}

export async function disconnectChrome() {
  const pending = connection
  connection = undefined
  // connectOverCDP 返回的 Browser.close 只断开连接；关闭默认 context 会退出用户的 Chrome。
  await pending?.then((browser) => browser.close()).catch(() => {})
}

async function relayEndpoint() {
  const value = JSON.parse(await readFile(path.join(relayDir(), 'relay.json'), 'utf8')) as { port: number; token: string }
  if (!Number.isInteger(value.port) || value.port < 1 || value.port > 65535 || !/^[a-f0-9]{64}$/.test(value.token)) throw new Error('Chrome 扩展连接地址无效')
  return `ws://127.0.0.1:${value.port}/?token=${value.token}`
}

async function connectRelay() {
  let failedEndpoint: string | undefined
  try {
    failedEndpoint = await relayEndpoint()
    return await chromium.connectOverCDP(failedEndpoint, { noDefaults: true, timeout: 2000 })
  } catch { /* Chrome 退出后由远程连接请求重新启动。 */ }
  await new Promise<void>((resolve, reject) => {
    execFile('/usr/bin/open', ['-gj', '-a', 'Google Chrome'], error => error ? reject(error) : resolve())
  })
  const deadline = Date.now() + 15000
  while (Date.now() < deadline) {
    await sleep(250)
    try {
      const endpoint = await relayEndpoint()
      if (endpoint === failedEndpoint) continue
      return await chromium.connectOverCDP(endpoint, { noDefaults: true, timeout: 2000 })
    } catch { /* 等待扩展和本机宿主启动。 */ }
  }
  throw new Error('个人 Chrome 扩展未连接')
}

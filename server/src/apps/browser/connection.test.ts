import { readFile } from 'node:fs/promises'
import { chromium } from 'playwright-core'
import type { Browser, BrowserContext } from 'playwright-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { activePortEndpoint, chromeContext, disconnectChrome } from './connection.js'

vi.mock('node:fs/promises', () => ({ readFile: vi.fn<typeof readFile>() }))
vi.mock('playwright-core', () => ({ chromium: { connectOverCDP: vi.fn<typeof chromium.connectOverCDP>() } }))

const context = { close: vi.fn<BrowserContext['close']>(), pages: vi.fn<BrowserContext['pages']>(), clearCookies: vi.fn<BrowserContext['clearCookies']>() } as unknown as BrowserContext
const browser = {
  contexts: vi.fn<Browser['contexts']>(() => [context]),
  on: vi.fn<Browser['on']>(),
  close: vi.fn<Browser['close']>(async () => {}),
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('BINOS_BROWSER_CDP_ENDPOINT', 'ws://127.0.0.1:9222/devtools/browser/test')
  vi.mocked(chromium.connectOverCDP).mockResolvedValue(browser as unknown as Browser)
})

afterEach(async () => {
  await disconnectChrome()
  vi.unstubAllEnvs()
})

describe('personal Chrome connection', () => {
  it('shares one connection without applying defaults to the personal browser', async () => {
    const contexts = await Promise.all([chromeContext(), chromeContext()])
    expect(contexts).toEqual([context, context])
    expect(chromium.connectOverCDP).toHaveBeenCalledExactlyOnceWith('ws://127.0.0.1:9222/devtools/browser/test', { noDefaults: true, timeout: 60000 })
    expect(context.pages).not.toHaveBeenCalled()
    expect(context.clearCookies).not.toHaveBeenCalled()
  })

  it('disconnects without closing the personal context or its tabs', async () => {
    await chromeContext()
    await disconnectChrome()
    expect(browser.close).toHaveBeenCalledOnce()
    expect(context.close).not.toHaveBeenCalled()
    expect(context.pages).not.toHaveBeenCalled()
    await chromeContext()
    expect(chromium.connectOverCDP).toHaveBeenCalledTimes(2)
  })

  it('allows reconnection after Chrome disconnects', async () => {
    await chromeContext()
    browser.on.mock.calls[0][1](browser as unknown as Browser)
    await chromeContext()
    expect(chromium.connectOverCDP).toHaveBeenCalledTimes(2)
  })

  it('gives actionable instructions and retries after a refused connection', async () => {
    vi.mocked(chromium.connectOverCDP).mockRejectedValueOnce(new Error('ECONNREFUSED'))
    await expect(chromeContext()).rejects.toThrow('chrome://inspect/#remote-debugging')
    expect(await chromeContext()).toBe(context)
  })

  it('discovers the current endpoint from Chrome instead of assuming a fixed port', async () => {
    vi.stubEnv('BINOS_BROWSER_CDP_ENDPOINT', undefined)
    vi.mocked(readFile).mockResolvedValue('9415\n/devtools/browser/current-session\n')
    await chromeContext()
    expect(chromium.connectOverCDP).toHaveBeenCalledWith('ws://127.0.0.1:9415/devtools/browser/current-session', expect.any(Object))
  })
})

describe('Chrome active port file', () => {
  it('accepts LF and CRLF endpoint files', () => {
    expect(activePortEndpoint('9222\n/devtools/browser/abc-123\n')).toBe('ws://127.0.0.1:9222/devtools/browser/abc-123')
    expect(activePortEndpoint('9300\r\n/devtools/browser/session\r\n')).toBe('ws://127.0.0.1:9300/devtools/browser/session')
  })

  it('rejects malformed ports and paths', () => {
    for (const value of ['', '0\n/devtools/browser/a', '65536\n/devtools/browser/a', 'abc\n/devtools/browser/a', '9222\nhttps://example.com', '9222\n/devtools/browser/a?query', '9222']) {
      expect(() => activePortEndpoint(value)).toThrow('Chrome 远程调试地址无效')
    }
  })
})

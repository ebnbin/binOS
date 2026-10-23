import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright-core'
import type { Browser, BrowserContext } from 'playwright-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { chromeContext, disconnectChrome } from './connection.js'

vi.mock('node:fs/promises', () => ({ mkdir: vi.fn<typeof mkdir>() }))
vi.mock('playwright-core', () => ({ chromium: {
  connectOverCDP: vi.fn<typeof chromium.connectOverCDP>(),
  launchPersistentContext: vi.fn<typeof chromium.launchPersistentContext>(),
} }))

const context = {
  close: vi.fn<BrowserContext['close']>().mockResolvedValue(undefined),
  on: vi.fn<BrowserContext['on']>(),
  clearCookies: vi.fn<BrowserContext['clearCookies']>(),
} as unknown as BrowserContext
const browser = {
  contexts: vi.fn<Browser['contexts']>(() => [context]),
  on: vi.fn<Browser['on']>(),
  close: vi.fn<Browser['close']>(async () => {}),
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('BINOS_ROOT', '/tmp/browser-test-root')
  vi.stubEnv('BINOS_BROWSER_CDP_ENDPOINT', undefined)
  vi.mocked(chromium.launchPersistentContext).mockResolvedValue(context)
  vi.mocked(chromium.connectOverCDP).mockResolvedValue(browser as unknown as Browser)
})

afterEach(async () => {
  await disconnectChrome()
  vi.unstubAllEnvs()
})

describe('managed Chrome connection', () => {
  it('shares one browser with a persistent profile scoped to the instance', async () => {
    expect(await Promise.all([chromeContext(), chromeContext()])).toEqual([context, context])
    expect(mkdir).toHaveBeenCalledWith('/tmp/browser-test-root/Library/Apps/browser/chrome', { recursive: true, mode: 0o700 })
    expect(chromium.launchPersistentContext).toHaveBeenCalledExactlyOnceWith('/tmp/browser-test-root/Library/Apps/browser/chrome', {
      channel: 'chrome', headless: false, chromiumSandbox: true, viewport: null,
    })
    expect(chromium.connectOverCDP).not.toHaveBeenCalled()
    expect(context.clearCookies).not.toHaveBeenCalled()
  })

  it('closes cleanly and reuses the same profile after a backend restart', async () => {
    await chromeContext()
    await disconnectChrome()
    expect(context.close).toHaveBeenCalledOnce()
    await chromeContext()
    const calls = vi.mocked(chromium.launchPersistentContext).mock.calls
    expect(calls).toHaveLength(2)
    expect(calls[0][0]).toBe(calls[1][0])
  })

  it('automatically launches again after the browser exits', async () => {
    await chromeContext()
    Reflect.apply(vi.mocked(context.on).mock.calls[0][1], undefined, [])
    await chromeContext()
    expect(chromium.launchPersistentContext).toHaveBeenCalledTimes(2)
  })

  it('retries after startup failure without falling back to personal Chrome', async () => {
    vi.mocked(chromium.launchPersistentContext).mockRejectedValueOnce(new Error('launch failed'))
    await expect(chromeContext()).rejects.toThrow('无法启动远程浏览器：launch failed')
    expect(await chromeContext()).toBe(context)
    expect(chromium.connectOverCDP).not.toHaveBeenCalled()
  })

  it('keeps an explicit external CDP connection separate from the managed profile', async () => {
    vi.stubEnv('BINOS_BROWSER_CDP_ENDPOINT', 'ws://127.0.0.1:9222/devtools/browser/test')
    await chromeContext()
    expect(chromium.connectOverCDP).toHaveBeenCalledExactlyOnceWith('ws://127.0.0.1:9222/devtools/browser/test', { noDefaults: true, timeout: 60000 })
    await disconnectChrome()
    expect(browser.close).toHaveBeenCalledOnce()
    expect(context.close).not.toHaveBeenCalled()
    expect(chromium.launchPersistentContext).not.toHaveBeenCalled()
  })
})

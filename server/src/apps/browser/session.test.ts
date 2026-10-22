import { EventEmitter } from 'node:events'
import type { BrowserContext, Page } from 'playwright-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { chromeContext, disconnectChrome } from './connection.js'
import type { ServerMessage } from './protocol.js'
import { connectBrowser, stopBrowser } from './session.js'

vi.mock('./connection.js', () => ({
  chromeContext: vi.fn<typeof chromeContext>(),
  disconnectChrome: vi.fn<typeof disconnectChrome>(),
}))

function mockPage() {
  let url = 'about:blank'
  const cdp = Object.assign(new EventEmitter(), {
    send: vi.fn<(method: string) => Promise<unknown>>(async (method: string) => method === 'Page.getNavigationHistory' ? { currentIndex: 0, entries: [{ url, title: 'Test page' }] } : {}),
  })
  const page = Object.assign(new EventEmitter(), {
    context: () => ({ newCDPSession: async () => cdp }),
    close: vi.fn<() => Promise<void>>(async () => { page.emit('close') }),
    goto: vi.fn<(next: string) => Promise<void>>(async (next: string) => { url = next }),
  })
  return { page, cdp }
}

let fixture: ReturnType<typeof mockPage>
let newPage: ReturnType<typeof vi.fn<BrowserContext['newPage']>>

beforeEach(() => {
  vi.useFakeTimers()
  fixture = mockPage()
  newPage = vi.fn<BrowserContext['newPage']>().mockResolvedValue(fixture.page as unknown as Page)
  vi.mocked(chromeContext).mockResolvedValue({ newPage } as unknown as BrowserContext)
})

afterEach(async () => {
  await stopBrowser()
  vi.useRealTimers()
  vi.clearAllMocks()
})

function client() {
  const messages: ServerMessage[] = []
  return {
    messages,
    send: (message: ServerMessage) => { messages.push(message) },
    close: vi.fn<(code?: number) => void>(),
    id: () => {
      const ready = messages.find((message) => message.type === 'ready')
      if (ready?.type !== 'ready') throw new Error('Browser not ready')
      return ready.id
    },
  }
}

describe('remote browser reconnection', () => {
  it('replaces an unclosed connection and preserves the existing page', async () => {
    const first = client()
    const old = await connectBrowser(undefined, first.send, first.close)
    const second = client()
    const fresh = await connectBrowser(first.id(), second.send, second.close)

    expect(second.id()).toBe(first.id())
    expect(newPage).toHaveBeenCalledOnce()
    expect(first.messages).toContainEqual({ type: 'replaced' })
    expect(first.close).toHaveBeenCalledExactlyOnceWith(4001)
    expect(fixture.page.close).not.toHaveBeenCalled()

    old.receive({ type: 'navigate', url: 'https://old.example/' })
    old.dispose()
    fresh.receive({ type: 'navigate', url: 'https://fresh.example/' })
    await vi.waitFor(() => expect(fixture.page.goto).toHaveBeenCalledExactlyOnceWith('https://fresh.example/', expect.any(Object)))
    expect(second.close).not.toHaveBeenCalled()
  })

  it('finishes old stream cleanup before starting the replacement stream', async () => {
    const first = client()
    await connectBrowser(undefined, first.send, first.close)
    let release: () => void = () => {}
    const cleanup = new Promise<void>((resolve) => { release = resolve })
    const originalSend = fixture.cdp.send.getMockImplementation()!
    fixture.cdp.send.mockImplementation(async (method) => {
      if (method === 'Page.stopScreencast') await cleanup
      return originalSend(method)
    })
    fixture.cdp.send.mockClear()
    const second = client()
    const connecting = connectBrowser(first.id(), second.send, second.close)
    await vi.waitFor(() => expect(fixture.cdp.send).toHaveBeenCalledWith('Page.stopScreencast'))
    expect(fixture.cdp.send.mock.calls.some(([method]) => method === 'Page.startScreencast')).toBe(false)
    release()
    await connecting
    expect(fixture.cdp.send.mock.calls.map(([method]) => method).slice(0, 2)).toEqual(['Page.stopScreencast', 'Page.startScreencast'])
  })

  it('allows only the newest of simultaneous replacements to remain active', async () => {
    const first = client()
    const old = await connectBrowser(undefined, first.send, first.close)
    const second = client()
    const third = client()
    const pendingSecond = connectBrowser(first.id(), second.send, second.close)
    const pendingThird = connectBrowser(first.id(), third.send, third.close)
    const [middle, fresh] = await Promise.all([pendingSecond, pendingThird])
    old.dispose()
    middle.dispose()
    for (let i = 0; i < 3; i++) {
      await vi.advanceTimersByTimeAsync(20000)
      fresh.receive({ type: 'ping' })
    }
    await vi.advanceTimersByTimeAsync(1000)
    expect(second.close).toHaveBeenCalledExactlyOnceWith(4001)
    expect(third.messages.some((message) => message.type === 'state')).toBe(true)
    expect(fixture.page.close).not.toHaveBeenCalled()
    expect(third.close).not.toHaveBeenCalled()
  })
})

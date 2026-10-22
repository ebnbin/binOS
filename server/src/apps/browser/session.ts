import { randomUUID } from 'node:crypto'
import type { CDPSession, Page } from 'playwright-core'
import { chromeContext, disconnectChrome } from './connection.js'
import type { ClientMessage, ServerMessage } from './protocol.js'

const sessions = new Map<string, Session>()
let opening = 0

class Session {
  readonly id = randomUUID()
  send: ((message: ServerMessage) => void) | undefined
  disconnect: ((replaced?: boolean) => void) | undefined
  expiry: ReturnType<typeof setTimeout> | undefined
  cdp!: CDPSession
  pendingFrame: number | undefined
  deferredFrame: { sessionId: number; data: string; width: number; height: number } | undefined
  frameWidth = 1200
  frameHeight = 800
  frame = 0
  chunksInFlight = 0
  remainingFrame = ''
  width = 1200
  height = 800
  scale = 1
  state = ''
  queue = Promise.resolve()

  readonly page: Page

  constructor(page: Page) { this.page = page }

  async start() {
    this.cdp = await this.page.context().newCDPSession(this.page)
    this.page.on('dialog', (dialog) => {
      this.emit({ type: 'error', message: `网页弹窗已关闭：${dialog.message().slice(0, 300)}` })
      void dialog.dismiss().catch(() => {})
    })
    this.page.on('popup', (popup) => {
      this.emit({ type: 'error', message: '当前远程模式暂不支持新窗口，请使用网页内的链接导航' })
      void popup.close().catch(() => {})
    })
    this.page.on('download', (download) => {
      this.emit({ type: 'error', message: '当前远程模式暂不支持文件下载' })
      void download.cancel().catch(() => {})
    })
    this.page.on('filechooser', () => this.emit({ type: 'error', message: '当前远程模式暂不支持文件上传' }))
    this.page.on('close', () => { this.disconnect?.(); this.destroy() })
    this.cdp.on('Page.screencastFrame', (frame) => {
      if (Math.abs(frame.metadata.deviceWidth - this.width * this.scale) > 1 || Math.abs(frame.metadata.deviceHeight - this.height * this.scale) > 1) {
        void this.cdp.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => {})
        return
      }
      this.offerFrame({ sessionId: frame.sessionId, data: frame.data, width: this.width, height: this.height })
    })
    await this.viewport()
  }

  async viewport() {
    await this.cdp.send('Emulation.setDeviceMetricsOverride', {
      width: this.width, height: this.height, deviceScaleFactor: this.scale, mobile: false,
      screenWidth: this.width, screenHeight: this.height,
      viewport: { x: 0, y: 0, width: this.width, height: this.height, scale: 1 },
    })
  }

  offerFrame(frame: { sessionId: number; data: string; width: number; height: number }) {
    if (!this.send) {
      void this.cdp.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => {})
      return
    }
    if (this.pendingFrame !== undefined) {
      if (this.deferredFrame) void this.cdp.send('Page.screencastFrameAck', { sessionId: this.deferredFrame.sessionId }).catch(() => {})
      this.deferredFrame = frame
      return
    }
    this.pendingFrame = frame.sessionId
    this.frame++
    this.frameWidth = frame.width
    this.frameHeight = frame.height
    this.remainingFrame = frame.data
    this.fillChunks()
  }

  emit(message: ServerMessage) {
    try { this.send?.(message) } catch { this.disconnect?.() }
  }

  async metadata() {
    const history = await this.cdp.send('Page.getNavigationHistory').catch((error: unknown) => {
      if (error instanceof Error && error.message.includes('Not attached to an active page')) return undefined
      throw error
    })
    if (!history) return
    const entry = history.entries[history.currentIndex]
    const state = {
      url: entry?.url === 'about:blank' ? '' : entry?.url ?? '', title: entry?.title ?? '',
      canBack: history.currentIndex > 0, canForward: history.currentIndex < history.entries.length - 1,
    }
    const serialized = JSON.stringify(state)
    if (this.state !== serialized && this.send) {
      this.state = serialized
      this.emit({ type: 'state', state })
    }
  }

  async stream() {
    await this.cdp.send('Page.startScreencast', {
      format: 'jpeg', quality: 85,
      maxWidth: Math.min(2560, Math.round(this.width * this.scale)),
      maxHeight: Math.min(2560, Math.round(this.height * this.scale)),
    })
  }

  async command(message: ClientMessage) {
    switch (message.type) {
      case 'navigate':
        await this.page.goto(message.url, { waitUntil: 'commit', timeout: 20000 })
        break
      case 'back': await this.page.goBack({ waitUntil: 'commit', timeout: 20000 }); break
      case 'forward': await this.page.goForward({ waitUntil: 'commit', timeout: 20000 }); break
      case 'reload': await this.page.reload({ waitUntil: 'commit', timeout: 20000 }); break
      case 'resize': {
        if (message.width === this.width && message.height === this.height && message.scale === this.scale) break
        await this.cdp.send('Page.stopScreencast')
        await this.ack()
        this.width = message.width
        this.height = message.height
        this.scale = Math.min(message.scale, 2560 / Math.max(this.width, this.height))
        await this.viewport()
        await this.stream()
        break
      }
      case 'pointer':
        await this.cdp.send('Input.dispatchMouseEvent', {
          type: { move: 'mouseMoved', down: 'mousePressed', up: 'mouseReleased' }[message.action] as 'mouseMoved' | 'mousePressed' | 'mouseReleased',
          x: message.x, y: message.y, button: message.button, buttons: message.buttons, clickCount: message.clickCount,
        })
        break
      case 'wheel':
        await this.cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: message.x, y: message.y, deltaX: message.deltaX, deltaY: message.deltaY })
        break
      case 'text': await this.cdp.send('Input.insertText', { text: message.text }); break
      case 'key': {
        const codes: Record<string, number> = { Backspace: 8, Tab: 9, Enter: 13, Escape: 27, ' ': 32, PageUp: 33, PageDown: 34, End: 35, Home: 36, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Delete: 46 }
        const keyCode = codes[message.key] ?? (message.key.length === 1 ? message.key.toUpperCase().charCodeAt(0) : 0)
        await this.cdp.send('Input.dispatchKeyEvent', {
          type: message.action === 'up' ? 'keyUp' : message.key === 'Enter' ? 'keyDown' : 'rawKeyDown',
          text: message.action === 'down' && message.key === 'Enter' ? '\r' : undefined, key: message.key, code: message.code,
          modifiers: message.modifiers, windowsVirtualKeyCode: keyCode,
          commands: message.action === 'down' && (message.modifiers & 6) && message.key.toLowerCase() === 'a' ? ['selectAll'] : undefined,
        })
        break
      }
    }
    await this.metadata()
  }

  fillChunks() {
    while (this.remainingFrame && this.chunksInFlight < 4) {
      const data = this.remainingFrame.slice(0, 48000)
      this.remainingFrame = this.remainingFrame.slice(48000)
      this.chunksInFlight++
      this.emit({ type: 'frame', frame: this.frame, data, more: !!this.remainingFrame, width: this.frameWidth, height: this.frameHeight })
    }
  }

  async ack() {
    const sessionId = this.pendingFrame
    const deferred = this.deferredFrame
    this.deferredFrame = undefined
    if (deferred) void this.cdp.send('Page.screencastFrameAck', { sessionId: deferred.sessionId }).catch(() => {})
    this.pendingFrame = undefined
    this.remainingFrame = ''
    this.chunksInFlight = 0
    if (sessionId !== undefined) await this.cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
  }

  destroy() {
    if (!sessions.delete(this.id)) return
    clearTimeout(this.expiry)
    this.send = undefined
    this.disconnect = undefined
    void this.page.close().catch(() => {})
  }
}

export async function connectBrowser(id: string | undefined, send: (message: ServerMessage) => void, close: (code?: number) => void) {
  let session = id ? sessions.get(id) : undefined
  session?.disconnect?.(true)
  if (!session) {
    if (sessions.size + opening >= 4) throw new Error('最多同时打开 4 个远程浏览器页面，请关闭不用的窗口后稍候重试')
    opening++
    let page: Page | undefined
    try {
      page = await (await chromeContext()).newPage()
      session = new Session(page)
      await session.start()
      sessions.set(session.id, session)
    } catch (error) {
      await page?.close().catch(() => {})
      throw error
    } finally { opening-- }
  }
  const current = session
  clearTimeout(current.expiry)
  current.send = send
  current.state = ''
  let disposed = false
  let lastSeen = Date.now()
  let queued = 0
  let polling = false
  const dispose = (replaced = false) => {
    if (disposed) return
    disposed = true
    clearInterval(timer)
    if (replaced) {
      try { send({ type: 'replaced' }) } catch { /* 旧连接可能已断网 */ }
    }
    current.send = undefined
    current.disconnect = undefined
    current.queue = current.queue.then(async () => {
      await current.cdp.send('Page.stopScreencast').catch(() => {})
      await current.ack()
    })
    current.expiry = setTimeout(() => current.destroy(), 60000)
    current.expiry.unref()
    close(replaced ? 4001 : 1000)
  }
  current.disconnect = dispose
  const timer = setInterval(() => {
    if (Date.now() - lastSeen > 45000) return dispose()
    current.emit({ type: 'ping' })
    if (!polling) {
      polling = true
      void current.metadata().catch(dispose).finally(() => { polling = false })
    }
  }, 1000)
  timer.unref()
  try {
    send({ type: 'ready', id: current.id })
    const start = current.queue.then(async () => {
      if (disposed) return
      await current.stream()
      await current.metadata()
    })
    current.queue = start.catch(() => {})
    await start
  } catch (error) { dispose(); throw error }
  return {
    dispose,
    receive(message: ClientMessage) {
      if (disposed) return
      lastSeen = Date.now()
      if (message.type === 'ping') return
      if (message.type === 'ack') {
        if (message.frame !== current.frame || current.pendingFrame === undefined) return
        if (current.chunksInFlight <= 0) return
        current.chunksInFlight--
        current.fillChunks()
        if (!current.chunksInFlight) {
          const latest = current.deferredFrame
          current.deferredFrame = undefined
          void current.ack()
          if (latest) current.offerFrame(latest)
        }
        return
      }
      if (queued >= 128) return dispose()
      queued++
      current.queue = current.queue.then(async () => {
        if (!disposed) await current.command(message)
      }).catch((error: unknown) => {
        current.emit({ type: 'error', message: error instanceof Error ? error.message : String(error) })
      }).finally(() => { queued-- })
    },
  }
}

export async function stopBrowser() {
  const owned = [...sessions.values()]
  for (const session of owned) { session.disconnect?.(); session.destroy() }
  await Promise.allSettled(owned.map((session) => session.page.close()))
  await disconnectChrome()
}

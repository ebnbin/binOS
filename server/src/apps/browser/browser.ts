import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { browserDir } from '../../paths.js'
import { ChromeUnavailable, connectChrome } from './chrome.js'
import type { CdpEvent, Chrome } from './chrome.js'
import type { BrowserEvent, Connection, InputEvent, TabAction, TabState, Viewport } from './types.js'

// binOS 在用户的 Chrome 里开一个专用窗口，只有一个标签页，所有打开浏览器 app 的窗口看的都是它
type Tab = { chrome: Chrome; targetId: string; sessionId: string }
type TargetInfo = { targetId: string; type: string; url: string; title: string; openerId?: string }
type History = { currentIndex: number; entries: { id: number; url: string; title: string }[] }

type Viewer = (event: BrowserEvent) => Promise<void>
type Frame = Extract<BrowserEvent, { type: 'frame' }>

// 值是发画面用的函数：上一帧还没发完时只留最新的一帧，网速跟不上时少发几帧，不在后端堆积
const viewers = new Map<Viewer, (frame: Frame) => void>()
let connection: Connection = { status: 'idle' }
let chrome: Promise<Chrome> | undefined
let tab: Promise<Tab> | undefined
// 当前的标签页，Chrome 的事件交给它
let current: Tab | undefined
let state: TabState = { url: '', title: '', loading: false, canGoBack: false, canGoForward: false }
// 页面不变时 Chrome 不发新画面，新打开的窗口先显示这一帧
let lastFrame: Frame | undefined
let viewport: Viewport = { width: 1280, height: 800, scale: 1 }
// Chrome 实际是否在推送画面；调整按顺序执行，前一个完成后再开始下一个
let screencasting = false
let screencastTask = Promise.resolve()
// 画面最多每秒 30 帧。Chrome 不等确认就会接着发，在这里限速，只发每个间隔里最新的一帧
const frameInterval = 1000 / 30
let lastFrameSent = 0
let frameTimer: NodeJS.Timeout | undefined

// 记下 binOS 的标签页，后端重启后接着用同一个窗口
const targetFile = path.join(browserDir, 'target-id')

function setConnection(next: Connection) {
  connection = next
  broadcast({ type: 'connection', connection })
}

function forgetTab() {
  tab = undefined
  current = undefined
  screencasting = false
}

// 每次连接都要用户在 Mac 上允许，所以只连一次，断开后等下一次用到时再连
function connect(): Promise<Chrome> {
  if (!chrome) {
    setConnection({ status: 'waiting' })
    chrome = connectChrome().then(
      (connected) => {
        setConnection({ status: 'connected' })
        connected.onEvent(handleEvent)
        connected.onClose(() => {
          chrome = undefined
          forgetTab()
          setConnection({ status: 'unavailable', reason: '和 Chrome 的连接已断开' })
        })
        return connected
      },
      (error: unknown) => {
        chrome = undefined
        setConnection({ status: 'unavailable', reason: error instanceof ChromeUnavailable ? error.message : String(error) })
        throw error
      },
    )
  }
  return chrome
}

function openTab(): Promise<Tab> {
  tab ??= createTab().catch((error: unknown) => {
    forgetTab()
    throw error
  })
  return tab
}

function savedTargetId() {
  try {
    return readFileSync(targetFile, 'utf8').trim()
  } catch {
    return undefined
  }
}

async function createTab(): Promise<Tab> {
  const browser = await connect()
  await browser.send('Target.setDiscoverTargets', { discover: true })
  const { targetInfos } = await browser.send<{ targetInfos: TargetInfo[] }>('Target.getTargets')
  const saved = savedTargetId()
  let targetId = targetInfos.find((info) => info.type === 'page' && info.targetId === saved)?.targetId
  if (!targetId) {
    ;({ targetId } = await browser.send<{ targetId: string }>('Target.createTarget', {
      url: 'about:blank',
      newWindow: true,
      background: true,
    }))
    mkdirSync(browserDir, { recursive: true })
    writeFileSync(targetFile, targetId)
  }
  const { sessionId } = await browser.send<{ sessionId: string }>('Target.attachToTarget', { targetId, flatten: true })
  const opened: Tab = { chrome: browser, targetId, sessionId }
  // 准备期间就要处理事件：开始推送后的画面要及时确认，Chrome 才会接着发
  current = opened
  await Promise.all([browser.send('Page.enable', {}, sessionId), keepRendering(opened)])
  await refresh(opened)
  await syncScreencast(opened)
  return opened
}

// 让页面始终认为自己在前台、有焦点，输入框才显示光标、响应 focus
async function keepRendering(target: Tab) {
  await Promise.all([
    target.chrome.send('Emulation.setFocusEmulationEnabled', { enabled: true }, target.sessionId),
    target.chrome.send('Page.setWebLifecycleState', { state: 'active' }, target.sessionId),
  ])
}

// 画面就是窗口里网页的部分，按视口调整窗口的大小。最小化的窗口不再渲染，所以只是推到屏幕左下角外面，
// macOS 会留一角在屏幕上。被遮挡或锁屏时仍然渲染
async function placeWindow(target: Tab) {
  const { windowId, bounds } = await target.chrome.send<{ windowId: number; bounds: { windowState: string } }>(
    'Browser.getWindowForTarget',
    { targetId: target.targetId },
  )
  if (bounds.windowState !== 'normal') {
    await target.chrome.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal' } })
  }
  // 标签栏、地址栏等占的尺寸
  const { result } = await target.chrome.send<{ result: { value: [number, number] } }>(
    'Runtime.evaluate',
    { expression: '[outerWidth - innerWidth, outerHeight - innerHeight]', returnByValue: true },
    target.sessionId,
  )
  const [frameWidth, frameHeight] = result.value
  await target.chrome.send('Browser.setWindowBounds', {
    windowId,
    bounds: { left: -100000, top: 100000, width: viewport.width + frameWidth, height: viewport.height + frameHeight },
  })
}

const redirected = new Set<string>()

function handleEvent({ method, params, sessionId }: CdpEvent) {
  if (!current) {
    return
  }
  const target = current
  if (method === 'Target.targetDestroyed' && params.targetId === target.targetId) {
    // 用户在 Mac 上关掉了这个窗口，下次用到时重新开一个
    forgetTab()
    return
  }
  if (method === 'Target.targetInfoChanged') {
    const info = params.targetInfo as TargetInfo
    if (info.targetId === target.targetId) {
      updateState({ url: info.url, title: info.title })
    } else if (info.openerId === target.targetId && info.type === 'page' && info.url && info.url !== 'about:blank' && !redirected.has(info.targetId)) {
      // 从这个标签页打开的新标签页改在当前页打开
      redirected.add(info.targetId)
      void target.chrome.send('Target.closeTarget', { targetId: info.targetId }).catch(() => {})
      void target.chrome.send('Page.navigate', { url: info.url }, target.sessionId).catch(() => {})
    }
    return
  }
  if (sessionId !== target.sessionId) {
    return
  }
  switch (method) {
    case 'Page.screencastFrame': {
      const { data, metadata, sessionId: frameId } = params as {
        data: string
        metadata: { deviceWidth: number; deviceHeight: number }
        sessionId: number
      }
      lastFrame = { type: 'frame', data, width: metadata.deviceWidth, height: metadata.deviceHeight }
      frameTimer ??= setTimeout(
        () => {
          frameTimer = undefined
          lastFrameSent = Date.now()
          viewers.forEach((push) => lastFrame && push(lastFrame))
        },
        Math.max(0, lastFrameSent + frameInterval - Date.now()),
      )
      void target.chrome.send('Page.screencastFrameAck', { sessionId: frameId }, target.sessionId).catch(() => {})
      break
    }
    case 'Page.frameStartedLoading':
    case 'Page.frameStoppedLoading':
      if (params.frameId === target.targetId) {
        updateState({ loading: method === 'Page.frameStartedLoading' })
        void refresh(target).catch(() => {})
      }
      break
    case 'Page.frameNavigated':
    case 'Page.navigatedWithinDocument':
      void refresh(target).catch(() => {})
      break
  }
}

function broadcast(event: BrowserEvent) {
  viewers.forEach((_, send) => void send(event).catch(() => {}))
}

function frameSender(send: Viewer) {
  let sending = false
  let next: Frame | undefined
  const push = (frame: Frame) => {
    if (sending) {
      next = frame
      return
    }
    sending = true
    void send(frame)
      .catch(() => {})
      .finally(() => {
        sending = false
        const queued = next
        next = undefined
        if (queued) {
          push(queued)
        }
      })
  }
  return push
}

function updateState(changes: Partial<TabState>) {
  const next = { ...state, ...changes }
  if ((Object.keys(next) as (keyof TabState)[]).some((key) => next[key] !== state[key])) {
    state = next
    broadcast({ type: 'state', state })
  }
}

async function history(target: Tab) {
  return await target.chrome.send<History>('Page.getNavigationHistory', {}, target.sessionId)
}

// targetInfoChanged 不一定带上加载完成后的标题，导航和加载结束时再读一次。只采用最后一次读取的结果
let refreshes = 0

async function refresh(target: Tab) {
  const id = ++refreshes
  const [{ currentIndex, entries }, { targetInfo }] = await Promise.all([
    history(target),
    target.chrome.send<{ targetInfo: TargetInfo }>('Target.getTargetInfo', { targetId: target.targetId }),
  ])
  if (id === refreshes) {
    updateState({
      url: targetInfo.url,
      title: targetInfo.title,
      canGoBack: currentIndex > 0,
      canGoForward: currentIndex < entries.length - 1,
    })
  }
}

// 有人在看时推送画面，没人看时停止。restart：视口变了，按新尺寸重新开始。开始时把窗口调整到视口的大小
function syncScreencast(target: Tab, restart = false) {
  const task = screencastTask.then(async () => {
    const send = (method: string, params?: Record<string, unknown>) => target.chrome.send(method, params, target.sessionId)
    if (screencasting && (restart || !viewers.size)) {
      screencasting = false
      await send('Page.stopScreencast')
    }
    if (!screencasting && viewers.size) {
      await placeWindow(target)
      const { width, height, scale } = viewport
      await send('Page.startScreencast', {
        format: 'jpeg',
        quality: 70,
        maxWidth: Math.round(width * scale),
        maxHeight: Math.round(height * scale),
      })
      screencasting = true
    }
  })
  screencastTask = task.catch(() => {})
  return task
}

// send 返回的 Promise 在画面发出后完成。返回取消订阅的函数
export function subscribe(send: Viewer): () => void {
  const push = frameSender(send)
  viewers.set(send, push)
  void send({ type: 'connection', connection }).catch(() => {})
  void send({ type: 'state', state }).catch(() => {})
  if (lastFrame) {
    push(lastFrame)
  }
  void reconnect()
  return () => {
    viewers.delete(send)
    void tab?.then((opened) => syncScreencast(opened)).catch(() => {})
  }
}

// 连不上的原因已经通过 connection 告诉页面
export async function reconnect() {
  await openTab()
    .then((opened) => syncScreencast(opened))
    .catch(() => {})
}

// 只记下尺寸，不为此连接 Chrome：连接要用户在 Mac 上允许
export async function setViewport(next: Viewport) {
  viewport = next
  if (tab) {
    await syncScreencast(await tab, true)
  }
}

// 不像网址的输入当作搜索
export function toUrl(input: string): string {
  const text = input.trim()
  if (/^(https?|file|about|chrome|data|view-source):/i.test(text)) {
    return text
  }
  if (!/\s/.test(text) && /^(localhost|[\w-]+(\.[\w-]+)+)(:\d+)?([/?#]|$)/i.test(text)) {
    return (/^(localhost|\d+\.\d+\.\d+\.\d+)/.test(text) ? 'http://' : 'https://') + text
  }
  return `https://www.google.com/search?q=${encodeURIComponent(text)}`
}

export async function navigate(input: string) {
  const opened = await openTab()
  await opened.chrome.send('Page.navigate', { url: toUrl(input) }, opened.sessionId)
}

export async function runAction(action: TabAction) {
  const opened = await openTab()
  const page = (method: string, params?: Record<string, unknown>) => opened.chrome.send(method, params, opened.sessionId)
  if (action === 'reload') {
    await page('Page.reload')
  } else if (action === 'stop') {
    await page('Page.stopLoading')
  } else {
    const { currentIndex, entries } = await history(opened)
    const entry = entries[currentIndex + (action === 'back' ? -1 : 1)]
    if (entry) {
      await page('Page.navigateToHistoryEntry', { entryId: entry.id })
    }
  }
}

// macOS 上的 Chrome 不会把发来的 ⌘ 快捷键当作编辑命令，要明确告诉它。粘贴由页面把剪贴板内容作为文字发过来
const editCommands: Record<string, string> = { a: 'selectAll', c: 'copy', x: 'cut', z: 'undo' }

export async function dispatchInput(events: InputEvent[]) {
  const opened = await openTab()
  const input = (method: string, params: Record<string, unknown>) => opened.chrome.send(method, params, opened.sessionId)
  for (const event of events) {
    switch (event.type) {
      case 'mouse':
        await input('Input.dispatchMouseEvent', {
          type: { down: 'mousePressed', up: 'mouseReleased', move: 'mouseMoved' }[event.action],
          x: event.x,
          y: event.y,
          button: event.button,
          clickCount: event.clickCount,
          modifiers: event.modifiers,
        })
        break
      case 'wheel':
        await input('Input.dispatchMouseEvent', {
          type: 'mouseWheel',
          x: event.x,
          y: event.y,
          deltaX: event.deltaX,
          deltaY: event.deltaY,
          modifiers: event.modifiers,
        })
        break
      case 'key': {
        const command = event.modifiers & 6 ? editCommands[event.key.toLowerCase()] : undefined
        await input('Input.dispatchKeyEvent', {
          type: event.action === 'up' ? 'keyUp' : event.text ? 'keyDown' : 'rawKeyDown',
          key: event.key,
          code: event.code,
          windowsVirtualKeyCode: event.keyCode,
          text: event.text,
          unmodifiedText: event.text,
          modifiers: event.modifiers,
          commands: command && event.action === 'down' ? [command === 'undo' && event.modifiers & 8 ? 'redo' : command] : undefined,
        })
        break
      }
      case 'text':
        await input('Input.insertText', { text: event.text })
        break
    }
  }
}

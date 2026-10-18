import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { browserDir } from '../../paths.js'
import { launchChrome } from './chrome.js'
import type { CdpEvent, Chrome } from './chrome.js'
import type { BrowserEvent, InputEvent, TabAction, TabState, Viewport } from './types.js'

// 只有一个标签页，所有打开浏览器的窗口看的都是它
type Tab = { chrome: Chrome; targetId: string; sessionId: string }
type TargetInfo = { targetId: string; type: string; url: string; title: string }
type History = { currentIndex: number; entries: { id: number; url: string; title: string }[] }

type Viewer = (event: BrowserEvent) => Promise<void>

const viewers = new Set<Viewer>()
let tab: Promise<Tab> | undefined
let state: TabState = { url: '', title: '', loading: false, canGoBack: false, canGoForward: false }
// 页面不变时 Chrome 不发新画面，新打开的窗口先显示这一帧
let lastFrame: BrowserEvent | undefined
let viewport: Viewport = { width: 1280, height: 800, scale: 1 }
// Chrome 实际是否在推送画面；调整按顺序执行，前一个完成后再开始下一个
let screencasting = false
let screencastTask = Promise.resolve()

// 第一次用到时启动 Chrome；Chrome 退出后，下一次用到时重新启动
function openTab(): Promise<Tab> {
  tab ??= launch().catch((error: unknown) => {
    tab = undefined
    throw error
  })
  return tab
}

async function launch(): Promise<Tab> {
  const profileDir = path.join(browserDir, 'profile')
  mkdirSync(profileDir, { recursive: true })
  const chrome = launchChrome(profileDir)
  chrome.onExit(() => {
    tab = undefined
    screencasting = false
  })
  const { userAgent } = await chrome.send<{ userAgent: string }>('Browser.getVersion')
  await chrome.send('Target.setDiscoverTargets', { discover: true })
  const { targetInfos } = await chrome.send<{ targetInfos: TargetInfo[] }>('Target.getTargets')
  const targetId =
    targetInfos.find((info) => info.type === 'page')?.targetId ??
    (await chrome.send<{ targetId: string }>('Target.createTarget', { url: 'about:blank' })).targetId
  updateState({ url: 'about:blank', title: '', loading: false })
  const { sessionId } = await chrome.send<{ sessionId: string }>('Target.attachToTarget', { targetId, flatten: true })
  const opened: Tab = { chrome, targetId, sessionId }
  chrome.onEvent((event) => handleEvent(opened, event))
  await Promise.all([
    chrome.send('Page.enable', {}, sessionId),
    // 网站会拒绝或区别对待带 HeadlessChrome 的 User-Agent
    chrome.send(
      'Emulation.setUserAgentOverride',
      { userAgent: userAgent.replace('HeadlessChrome', 'Chrome'), acceptLanguage: 'zh-CN,zh;q=0.9,en;q=0.8' },
      sessionId,
    ),
    // 让页面认为自己有焦点，输入框才显示光标、响应 focus
    chrome.send('Emulation.setFocusEmulationEnabled', { enabled: true }, sessionId),
    applyViewport(opened),
  ])
  await refresh(opened)
  await syncScreencast(opened)
  return opened
}

const redirected = new Set<string>()

function handleEvent(current: Tab, { method, params, sessionId }: CdpEvent) {
  if (method === 'Target.targetInfoChanged') {
    const info = params.targetInfo as TargetInfo
    if (info.targetId === current.targetId) {
      updateState({ url: info.url, title: info.title })
    } else if (info.type === 'page' && info.url && info.url !== 'about:blank' && !redirected.has(info.targetId)) {
      // 在新标签页打开的链接改在当前页打开
      redirected.add(info.targetId)
      void current.chrome.send('Target.closeTarget', { targetId: info.targetId }).catch(() => {})
      void current.chrome.send('Page.navigate', { url: info.url }, current.sessionId).catch(() => {})
    }
    return
  }
  if (sessionId !== current.sessionId) {
    return
  }
  switch (method) {
    case 'Page.screencastFrame': {
      const { data, metadata, sessionId: frameId } = params as {
        data: string
        metadata: { deviceWidth: number; deviceHeight: number }
        sessionId: number
      }
      const frame: BrowserEvent = { type: 'frame', data, width: metadata.deviceWidth, height: metadata.deviceHeight }
      lastFrame = frame
      // 发出去之后再要下一帧，网速跟不上时少发几帧，不在后端堆积
      void broadcast(frame).then(() =>
        current.chrome.send('Page.screencastFrameAck', { sessionId: frameId }, current.sessionId).catch(() => {}),
      )
      break
    }
    case 'Page.frameStartedLoading':
    case 'Page.frameStoppedLoading':
      if (params.frameId === current.targetId) {
        updateState({ loading: method === 'Page.frameStartedLoading' })
        void refresh(current).catch(() => {})
      }
      break
    case 'Page.frameNavigated':
    case 'Page.navigatedWithinDocument':
      void refresh(current).catch(() => {})
      break
  }
}

async function broadcast(event: BrowserEvent) {
  await Promise.all([...viewers].map((send) => send(event).catch(() => {})))
}

function updateState(changes: Partial<TabState>) {
  const next = { ...state, ...changes }
  if ((Object.keys(next) as (keyof TabState)[]).some((key) => next[key] !== state[key])) {
    state = next
    void broadcast({ type: 'state', state })
  }
}

async function history(current: Tab) {
  return await current.chrome.send<History>('Page.getNavigationHistory', {}, current.sessionId)
}

// targetInfoChanged 不一定带上加载完成后的标题，导航和加载结束时再读一次。只采用最后一次读取的结果
let refreshes = 0

async function refresh(current: Tab) {
  const id = ++refreshes
  const [{ currentIndex, entries }, { targetInfo }] = await Promise.all([
    history(current),
    current.chrome.send<{ targetInfo: TargetInfo }>('Target.getTargetInfo', { targetId: current.targetId }),
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

async function applyViewport(current: Tab) {
  const { width, height, scale } = viewport
  await current.chrome.send(
    'Emulation.setDeviceMetricsOverride',
    { width, height, deviceScaleFactor: scale, mobile: false },
    current.sessionId,
  )
  await syncScreencast(current, true)
}

// 有人在看时推送画面，没人看时停止。restart：视口变了，按新尺寸重新开始
function syncScreencast(current: Tab, restart = false) {
  const task = screencastTask.then(async () => {
    const send = (method: string, params?: Record<string, unknown>) => current.chrome.send(method, params, current.sessionId)
    if (screencasting && (restart || !viewers.size)) {
      screencasting = false
      await send('Page.stopScreencast')
    }
    if (!screencasting && viewers.size) {
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
  viewers.add(send)
  void send({ type: 'state', state }).catch(() => {})
  if (lastFrame) {
    void send(lastFrame).catch(() => {})
  }
  void openTab()
    .then((current) => syncScreencast(current))
    .catch((error: unknown) => console.error('浏览器启动失败', error))
  return () => {
    viewers.delete(send)
    void tab?.then((current) => syncScreencast(current)).catch(() => {})
  }
}

export async function setViewport(next: Viewport) {
  viewport = next
  await applyViewport(await openTab())
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
  const current = await openTab()
  await current.chrome.send('Page.navigate', { url: toUrl(input) }, current.sessionId)
}

export async function runAction(action: TabAction) {
  const current = await openTab()
  const page = (method: string, params?: Record<string, unknown>) => current.chrome.send(method, params, current.sessionId)
  if (action === 'reload') {
    await page('Page.reload')
  } else if (action === 'stop') {
    await page('Page.stopLoading')
  } else {
    const { currentIndex, entries } = await history(current)
    const entry = entries[currentIndex + (action === 'back' ? -1 : 1)]
    if (entry) {
      await page('Page.navigateToHistoryEntry', { entryId: entry.id })
    }
  }
}

// macOS 上的 headless Chrome 不会把 ⌘ 快捷键当作编辑命令，要明确告诉它。粘贴由页面把剪贴板内容作为文字发过来
const editCommands: Record<string, string> = { a: 'selectAll', c: 'copy', x: 'cut', z: 'undo' }

export async function dispatchInput(events: InputEvent[]) {
  const current = await openTab()
  const input = (method: string, params: Record<string, unknown>) => current.chrome.send(method, params, current.sessionId)
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

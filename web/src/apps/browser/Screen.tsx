import type { BrowserEvent, Connection, TabState } from '@binos/server/apps/browser/types'
import type { RefObject } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { connectEventSource } from '../../eventSource.ts'
import { useElementSize } from '../../ui/useElementSize.ts'
import { reconnect, setViewport, streamUrl } from './api.ts'
import { createInputQueue, modifiers, mouseButton } from './input.ts'
import styles from './Screen.module.css'

// 超过这个距离算拖动（触屏上是滚动），否则算点击
const dragThreshold = 8

// 显示 Chrome 的画面，把鼠标、触摸和键盘转发过去。画面的一个 CSS 像素就是页面的一个 CSS 像素，坐标不用换算。
// 键盘输入都经过隐藏的 keyboard：输入法组字、手机的软键盘和粘贴都靠它
export function Screen({ onState, keyboardRef }: { onState: (state: TabState) => void; keyboardRef: RefObject<HTMLTextAreaElement | null> }) {
  const [ref, size] = useElementSize<HTMLDivElement>()
  const send = useMemo(() => createInputQueue(), [])
  const [connected, setConnected] = useState(false)
  const [chrome, setChrome] = useState<Connection>({ status: 'idle' })
  const [hasFrame, setHasFrame] = useState(false)

  // 视口跟随窗口尺寸；重连后再设置一次，后端可能已经重启
  useEffect(() => {
    if (!size || !connected) {
      return
    }
    const timer = window.setTimeout(() => {
      void setViewport({
        width: Math.max(100, Math.round(size.width)),
        height: Math.max(100, Math.round(size.height)),
        scale: Math.min(Math.max(window.devicePixelRatio, 1), 2),
      })
    }, 150)
    return () => window.clearTimeout(timer)
  }, [size, connected])

  useEffect(() => {
    const canvas = ref.current!.querySelector('canvas')!
    const context = canvas.getContext('2d')!
    // 解码是异步的，晚到的旧画面不再画
    let received = 0
    let drawn = 0
    const draw = async (frame: Extract<BrowserEvent, { type: 'frame' }>) => {
      const id = ++received
      const bitmap = await createImageBitmap(await (await fetch(`data:image/jpeg;base64,${frame.data}`)).blob())
      if (id > drawn) {
        drawn = id
        if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
          canvas.width = bitmap.width
          canvas.height = bitmap.height
        }
        canvas.style.width = `${frame.width}px`
        canvas.style.height = `${frame.height}px`
        context.drawImage(bitmap, 0, 0)
        setHasFrame(true)
      }
      bitmap.close()
    }
    return connectEventSource(streamUrl, {
      onMessage: (data) => {
        const event: BrowserEvent = JSON.parse(data)
        if (event.type === 'connection') {
          setChrome(event.connection)
        } else if (event.type === 'state') {
          onState(event.state)
        } else {
          void draw(event)
        }
      },
      onConnectedChange: setConnected,
    })
  }, [ref, onState])

  useEffect(() => {
    const surface = ref.current!
    const keyboard = keyboardRef.current!
    const point = (event: { clientX: number; clientY: number }) => {
      const rect = surface.getBoundingClientRect()
      return { x: event.clientX - rect.left, y: event.clientY - rect.top }
    }

    let held: ReturnType<typeof mouseButton> = 'none'
    let clickCount = 0
    let lastDown = { time: 0, x: 0, y: 0 }
    let touch: { x: number; y: number; lastX: number; lastY: number; scrolling: boolean } | undefined

    // 鼠标点进画面就接收键盘；触屏上由工具栏的按钮调出软键盘，点一下页面不弹出
    const onMouseDown = (event: MouseEvent) => event.preventDefault()
    const onPointerDown = (event: PointerEvent) => {
      if (!event.isPrimary) {
        return
      }
      const { x, y } = point(event)
      if (event.pointerType === 'mouse') {
        keyboard.focus({ preventScroll: true })
        surface.setPointerCapture(event.pointerId)
        clickCount = event.timeStamp - lastDown.time < 500 && Math.hypot(x - lastDown.x, y - lastDown.y) < dragThreshold ? clickCount + 1 : 1
        lastDown = { time: event.timeStamp, x, y }
        held = mouseButton(event.button)
        send({ type: 'mouse', action: 'down', x, y, button: held, clickCount, modifiers: modifiers(event) })
      } else {
        touch = { x, y, lastX: x, lastY: y, scrolling: false }
      }
    }
    const onPointerMove = (event: PointerEvent) => {
      if (!event.isPrimary) {
        return
      }
      const { x, y } = point(event)
      if (event.pointerType === 'mouse') {
        send({ type: 'mouse', action: 'move', x, y, button: held, clickCount: held === 'none' ? 0 : clickCount, modifiers: modifiers(event) })
      } else if (touch) {
        touch.scrolling ||= Math.hypot(x - touch.x, y - touch.y) > dragThreshold
        if (touch.scrolling) {
          send({ type: 'wheel', x: touch.x, y: touch.y, deltaX: touch.lastX - x, deltaY: touch.lastY - y, modifiers: 0 })
          touch.lastX = x
          touch.lastY = y
        }
      }
    }
    const onPointerUp = (event: PointerEvent) => {
      if (!event.isPrimary) {
        return
      }
      if (event.pointerType === 'mouse') {
        const { x, y } = point(event)
        send({ type: 'mouse', action: 'up', x, y, button: held, clickCount, modifiers: modifiers(event) })
        held = 'none'
      } else if (touch && !touch.scrolling) {
        const { x, y } = touch
        send({ type: 'mouse', action: 'move', x, y, button: 'none', clickCount: 0, modifiers: 0 })
        send({ type: 'mouse', action: 'down', x, y, button: 'left', clickCount: 1, modifiers: 0 })
        send({ type: 'mouse', action: 'up', x, y, button: 'left', clickCount: 1, modifiers: 0 })
      }
      touch = undefined
    }
    const onPointerCancel = () => {
      touch = undefined
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 40 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? surface.clientHeight : 1
      send({ type: 'wheel', ...point(event), deltaX: event.deltaX * unit, deltaY: event.deltaY * unit, modifiers: modifiers(event) })
    }
    const onContextMenu = (event: Event) => event.preventDefault()

    // 按下时发过的键，松开时才发
    const pressed = new Set<string>()
    const onKeyDown = (event: KeyboardEvent) => {
      // 组字中的按键交给输入法；粘贴等 paste 事件拿到剪贴板的内容
      if (event.isComposing || event.keyCode === 229 || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'v')) {
        return
      }
      event.preventDefault()
      const printable = [...event.key].length === 1 && !event.metaKey && !event.ctrlKey
      const text = printable ? event.key : event.key === 'Enter' ? '\r' : undefined
      pressed.add(event.code)
      send({ type: 'key', action: 'down', key: event.key, code: event.code, keyCode: event.keyCode, text, modifiers: modifiers(event) })
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (pressed.delete(event.code)) {
        send({ type: 'key', action: 'up', key: event.key, code: event.code, keyCode: event.keyCode, modifiers: modifiers(event) })
      }
    }
    // 输入法和软键盘的文字写进 keyboard 后整段发出
    const flushText = () => {
      if (keyboard.value) {
        send({ type: 'text', text: keyboard.value })
        keyboard.value = ''
      }
    }
    const onInput = (event: Event) => {
      if (!(event as globalThis.InputEvent).isComposing) {
        flushText()
      }
    }
    const onPaste = (event: ClipboardEvent) => {
      event.preventDefault()
      const text = event.clipboardData?.getData('text/plain')
      if (text) {
        send({ type: 'text', text })
      }
    }

    const listeners: [EventTarget, string, (event: never) => void, AddEventListenerOptions?][] = [
      [surface, 'mousedown', onMouseDown],
      [surface, 'pointerdown', onPointerDown],
      [surface, 'pointermove', onPointerMove],
      [surface, 'pointerup', onPointerUp],
      [surface, 'pointercancel', onPointerCancel],
      [surface, 'wheel', onWheel, { passive: false }],
      [surface, 'contextmenu', onContextMenu],
      [keyboard, 'keydown', onKeyDown],
      [keyboard, 'keyup', onKeyUp],
      [keyboard, 'input', onInput],
      [keyboard, 'compositionend', flushText],
      [keyboard, 'paste', onPaste],
    ]
    for (const [target, type, listener, options] of listeners) {
      target.addEventListener(type, listener as EventListener, options)
    }
    return () => {
      for (const [target, type, listener] of listeners) {
        target.removeEventListener(type, listener as EventListener)
      }
    }
  }, [ref, keyboardRef, send])

  return (
    <div ref={ref} className={styles.screen}>
      <canvas className={styles.canvas} />
      <textarea
        ref={keyboardRef}
        className={styles.keyboard}
        aria-label="向网页输入"
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
      />
      {(!connected || chrome.status !== 'connected' || !hasFrame) && (
        <div className={styles.message}>
          {!connected ? (
            <p>正在连接 binOS…</p>
          ) : chrome.status === 'unavailable' ? (
            <>
              <p>连不上 Mac 上的 Chrome：{chrome.reason}</p>
              <p className={styles.hint}>确认 Chrome 正在运行，并且在 chrome://inspect/#remote-debugging 里开启了远程调试</p>
              <button type="button" onClick={() => void reconnect()}>
                重新连接
              </button>
            </>
          ) : chrome.status === 'connected' ? (
            <p>正在打开页面…</p>
          ) : (
            <p>请在 Mac 上的 Chrome 里允许 binOS 连接</p>
          )}
        </div>
      )}
    </div>
  )
}

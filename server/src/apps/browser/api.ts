import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { validator } from 'hono/validator'
import { connectedPreamble, keepAlive } from '../../sse.js'
import { dispatchInput, navigate, reconnect, runAction, setViewport, subscribe } from './browser.js'
import type { InputEvent, TabAction, Viewport } from './types.js'

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const isString = (value: unknown): value is string => typeof value === 'string'
const oneOf = <T extends string>(value: unknown, options: readonly T[]): value is T => options.includes(value as T)

// 逐个字段重新组装，不把多余的字段传给 Chrome
function parseInput(value: unknown): InputEvent | undefined {
  const event = (value ?? {}) as Record<string, unknown>
  const { x, y, modifiers } = event
  switch (event.type) {
    case 'mouse': {
      const { action, button, clickCount } = event
      return oneOf(action, ['down', 'up', 'move'] as const) &&
        oneOf(button, ['none', 'left', 'middle', 'right'] as const) &&
        isNumber(x) &&
        isNumber(y) &&
        isNumber(clickCount) &&
        isNumber(modifiers)
        ? { type: 'mouse', action, x, y, button, clickCount, modifiers }
        : undefined
    }
    case 'wheel': {
      const { deltaX, deltaY } = event
      return isNumber(x) && isNumber(y) && isNumber(deltaX) && isNumber(deltaY) && isNumber(modifiers)
        ? { type: 'wheel', x, y, deltaX, deltaY, modifiers }
        : undefined
    }
    case 'key': {
      const { action, key, code, keyCode, text } = event
      return oneOf(action, ['down', 'up'] as const) &&
        isString(key) &&
        isString(code) &&
        isNumber(keyCode) &&
        (text === undefined || isString(text)) &&
        isNumber(modifiers)
        ? { type: 'key', action, key, code, keyCode, text, modifiers }
        : undefined
    }
    case 'text':
      return isString(event.text) ? { type: 'text', text: event.text } : undefined
  }
  return undefined
}

const inputBody = validator('json', (value, c) => {
  const raw = (value as { events?: unknown } | null)?.events
  const events = Array.isArray(raw) ? raw.map(parseInput) : []
  if (!events.length || !events.every((event) => event !== undefined)) {
    return c.text('Bad Request', 400)
  }
  return { events }
})

const viewportBody = validator('json', (value, c) => {
  const { width, height, scale } = (value ?? {}) as Record<string, unknown>
  const inRange = (n: unknown, min: number, max: number): n is number => isNumber(n) && n >= min && n <= max
  if (!inRange(width, 100, 4000) || !inRange(height, 100, 4000) || !inRange(scale, 1, 3)) {
    return c.text('Bad Request', 400)
  }
  return { width: Math.round(width), height: Math.round(height), scale } satisfies Viewport
})

const navigateBody = validator('json', (value, c) => {
  const url = (value as { url?: unknown } | null)?.url
  if (!isString(url) || !url.trim()) {
    return c.text('Bad Request', 400)
  }
  return { url }
})

const actionBody = validator('json', (value, c) => {
  const action = (value as { action?: unknown } | null)?.action
  if (!oneOf(action, ['back', 'forward', 'reload', 'stop'] satisfies TabAction[])) {
    return c.text('Bad Request', 400)
  }
  return { action }
})

export const browserApi = new Hono()
  // 先发连接状态、标签页状态和最后一帧，之后有变化时推送
  .get('/stream', (c) =>
    streamSSE(c, async (stream) => {
      await stream.write(connectedPreamble)
      stream.onAbort(subscribe((event) => stream.writeSSE({ data: JSON.stringify(event) })))
      await keepAlive(stream)
    }),
  )
  // 连接断开或被拒绝后，由用户手动重新连接，免得反复在 Mac 上弹窗
  .post('/connect', async (c) => {
    await reconnect()
    return c.json({ ok: true }, 200)
  })
  .post('/viewport', viewportBody, async (c) => {
    await setViewport(c.req.valid('json'))
    return c.json({ ok: true }, 200)
  })
  .post('/navigate', navigateBody, async (c) => {
    await navigate(c.req.valid('json').url)
    return c.json({ ok: true }, 200)
  })
  .post('/action', actionBody, async (c) => {
    await runAction(c.req.valid('json').action)
    return c.json({ ok: true }, 200)
  })
  .post('/input', inputBody, async (c) => {
    await dispatchInput(c.req.valid('json').events)
    return c.json({ ok: true }, 200)
  })

export type BrowserApi = typeof browserApi

import { describe, expect, it } from 'vitest'
import { navigationUrl, parseMessage } from './protocol.js'

describe('remote browser protocol', () => {
  it('rejects privileged URLs and URLs containing credentials', () => {
    for (const url of ['file:///etc/passwd', 'javascript:alert(1)', 'data:text/html,test', 'chrome://settings', 'https://name:password@example.com', 'invalid']) {
      expect(parseMessage({ type: 'navigate', url })).toBeUndefined()
      expect(() => navigationUrl(url)).toThrow(/HTTP|Invalid URL/)
    }
    expect(parseMessage({ type: 'navigate', url: 'https://example.com' })).toEqual({ type: 'navigate', url: 'https://example.com/' })
  })

  it('bounds viewport, pointer, wheel and input messages', () => {
    for (const value of [
      null, {}, { type: 'resize', width: 0, height: 800, scale: 1 },
      { type: 'resize', width: 4000, height: 800, scale: 3 },
      { type: 'resize', width: Infinity, height: 800, scale: 1 },
      { type: 'pointer', action: 'down', x: -1, y: 0, button: 'left', buttons: 1, clickCount: 1 },
      { type: 'wheel', x: 0, y: 0, deltaX: 0, deltaY: 10001 },
      { type: 'key', action: 'down', key: 'a', code: 'KeyA', modifiers: 16 },
      { type: 'text', text: 'a'.repeat(16385) },
    ]) expect(parseMessage(value)).toBeUndefined()
    expect(parseMessage({ type: 'text', text: '中文输入' })).toEqual({ type: 'text', text: '中文输入' })
    expect(parseMessage({ type: 'resize', width: 390.25, height: 700, scale: 2 })).toEqual({ type: 'resize', width: 390, height: 700, scale: 2 })
  })

  it('requires a valid frame identifier for backpressure acknowledgements', () => {
    for (const frame of [undefined, -1, 0, 1.5, '1', Infinity]) expect(parseMessage({ type: 'ack', frame })).toBeUndefined()
    expect(parseMessage({ type: 'ack', frame: 12 })).toEqual({ type: 'ack', frame: 12 })
  })
})

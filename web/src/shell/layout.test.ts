import { describe, expect, it } from 'vitest'
import { clampFrame, normalizeFocus, raise } from './layout.ts'

const area = { top: 28, width: 1000, height: 700 }
const frame = (x: number, y: number, w: number, h: number) => ({ x, y, w, h, minimized: false, maximized: false })

describe('clampFrame', () => {
  it('跑到屏幕外的窗口拉回来，至少露出标题栏', () => {
    expect(clampFrame(frame(2000, 900, 400, 300), area)).toMatchObject({ x: 880, y: 692 })
    expect(clampFrame(frame(-1000, -50, 400, 300), area)).toMatchObject({ x: -280, y: 28 })
  })

  it('比屏幕还大的窗口缩到屏幕大小，但不小于最小尺寸', () => {
    expect(clampFrame(frame(0, 28, 3000, 2000), area)).toMatchObject({ w: 1000, h: 700 })
    expect(clampFrame(frame(0, 28, 10, 10), { top: 0, width: 200, height: 100 })).toMatchObject({ w: 320, h: 200 })
  })
})

describe('normalizeFocus', () => {
  it('去掉已关掉的窗口，别的设备新开的放在最下面，不抢聚焦', () => {
    expect(normalizeFocus({ stack: ['a', 'gone', 'b'], focused: 'gone' }, ['b', 'c', 'a'])).toEqual({ stack: ['c', 'a', 'b'], focused: null })
    expect(normalizeFocus(null, ['a'])).toEqual({ stack: ['a'], focused: null })
  })

  it('聚焦时移到最上面', () => {
    expect(raise({ stack: ['a', 'b', 'c'], focused: 'c' }, 'a')).toEqual({ stack: ['b', 'c', 'a'], focused: 'a' })
  })
})

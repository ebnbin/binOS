import { describe, expect, it } from 'vitest'
import { floatingBounds, floatingOffset, moveFloating, restorePosition } from './floatingPosition.ts'

describe('悬浮播放器位置', () => {
  it('位置按可移动范围归一化，窗口缩小和横竖屏切换仍留在屏幕内', () => {
    const position = { x: 0.8, y: 0.9 }
    for (const screen of [{ width: 1440, height: 900 }, { width: 320, height: 480 }, { width: 740, height: 280 }]) {
      const panel = { width: Math.min(320, screen.width - 24), height: 158 }
      const offset = floatingOffset(position, floatingBounds(screen, panel))
      expect(offset.x).toBeGreaterThanOrEqual(12)
      expect(offset.y).toBeGreaterThanOrEqual(12)
      expect(offset.x + panel.width).toBeLessThanOrEqual(screen.width - 12)
      expect(offset.y + panel.height).toBeLessThanOrEqual(screen.height - 12)
    }
  })
  it('拖动越界时停在边缘，没有移动空间时不会产生无效数值', () => {
    expect(moveFloating({ x: 0.5, y: 0.5 }, { x: -1000, y: 1000 }, { x: 200, y: 300 })).toEqual({ x: 0, y: 1 })
    expect(moveFloating({ x: 1, y: 1 }, { x: 16, y: 16 }, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 })
  })
  it('忽略损坏的位置记录并限制范围', () => {
    for (const value of [null, {}, 'bad', { x: Infinity, y: 1 }, { x: 0.5, y: null }]) expect(restorePosition(value)).toEqual({ x: 1, y: 1 })
    expect(restorePosition({ x: -1, y: 2 })).toEqual({ x: 0, y: 1 })
  })
})

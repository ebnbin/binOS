import { describe, expect, it } from 'vitest'
import { allowedLayouts, arrange, desktopColumns, fitLayout, normalizeWorkspace, place, relayout } from './layout.ts'

describe('desktopColumns', () => {
  it('一栏 360～480，最多 3 栏，多出来的留给左右两边', () => {
    expect(desktopColumns(360)).toEqual({ count: 1, columnWidth: 360, scale: 1 })
    expect(desktopColumns(719)).toMatchObject({ count: 1, columnWidth: 480 })
    expect(desktopColumns(744)).toMatchObject({ count: 2, columnWidth: 372 })
    expect(desktopColumns(1080)).toMatchObject({ count: 3, columnWidth: 360 })
    expect(desktopColumns(3440)).toMatchObject({ count: 3, columnWidth: 480 })
  })
})

describe('allowedLayouts', () => {
  it('分屏时每个窗口至少 360 宽、480 高，手机横竖都不能分屏', () => {
    expect(allowedLayouts({ width: 440, height: 860 })).toEqual(['1'])
    expect(allowedLayouts({ width: 832, height: 419 })).toEqual(['1'])
  })

  it('横屏左右分，竖屏上下分', () => {
    expect(allowedLayouts({ width: 890, height: 576 })).toEqual(['1', '1:1'])
    expect(allowedLayouts({ width: 576, height: 890 })).toEqual(['1'])
    expect(allowedLayouts({ width: 744, height: 1089 })).toEqual(['1', '1:1'])
    expect(allowedLayouts({ width: 1080, height: 600 })).toEqual(['1', '1:1', '1:2', '2:1', '1:1:1'])
    expect(allowedLayouts({ width: 1032, height: 1440 })).toEqual(['1', '1:1', '1:2', '2:1', '1:1:1'])
  })
})

describe('fitLayout', () => {
  it('放不下时先降为平分，再降为一个', () => {
    expect(fitLayout('1:1:1', ['1', '1:1'])).toBe('1:1')
    expect(fitLayout('1:2', ['1'])).toBe('1')
    expect(fitLayout('2:1', ['1', '1:1', '1:2', '2:1', '1:1:1'])).toBe('2:1')
  })
})

describe('normalizeWorkspace', () => {
  it('去掉已经关掉的窗口，补齐 3 个位置', () => {
    expect(normalizeWorkspace({ layout: '1:1', slots: ['a', 'gone'] }, ['a', 'b'])).toEqual({ layout: '1:1', slots: ['a', null, null] })
    expect(normalizeWorkspace(null, [])).toEqual({ layout: '1', slots: [null, null, null] })
  })
})

describe('arrange', () => {
  const workspace = { layout: '1:1:1' as const, slots: ['a', 'b', 'c'] }

  it('降级后按位置取前面的窗口', () => {
    expect(arrange(workspace, '1:1', 'c')).toEqual(['a', 'b'])
  })

  it('只有一个位置时显示本设备聚焦的窗口', () => {
    expect(arrange(workspace, '1', 'c')).toEqual(['c'])
    expect(arrange(workspace, '1', null)).toEqual(['a'])
  })
})

describe('relayout', () => {
  it('换成分屏时，聚焦的窗口在里面，空位用最近用过的补上', () => {
    expect(relayout({ layout: '1', slots: [null, null, null] }, '1:1', 'a', ['a', 'b', 'c'])).toEqual({ layout: '1:1', slots: ['a', 'b', null] })
    expect(relayout({ layout: '1:1', slots: ['b', 'c', null] }, '1:1:1', 'a', ['a', 'b'])).toEqual({ layout: '1:1:1', slots: ['b', 'c', 'a'] })
    expect(relayout({ layout: '1:1', slots: ['b', 'c', 'a'] }, '1:1', 'a', [])).toEqual({ layout: '1:1', slots: ['a', 'c', null] })
  })
})

describe('place', () => {
  it('已经在别的位置上时对调', () => {
    expect(place({ layout: '1:1', slots: ['a', 'b', null] }, 'b', 0).slots).toEqual(['b', 'a', null])
    expect(place({ layout: '1:1', slots: ['a', 'b', null] }, 'c', 1).slots).toEqual(['a', 'c', null])
  })
})

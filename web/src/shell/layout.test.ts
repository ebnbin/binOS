import { describe, expect, it } from 'vitest'
import { allowedLayouts, arrange, desktopColumns, fitLayout, normalizeWorkspace, packColumn, place, paneSizes, snapLayout, splitColumns } from './layout.ts'

describe('desktopColumns', () => {
  it('一栏 360～480，最多 3 栏，多出来的留给左右两边', () => {
    expect(desktopColumns(360)).toEqual({ count: 1, columnWidth: 360, scale: 1 })
    expect(desktopColumns(719)).toMatchObject({ count: 1, columnWidth: 480 })
    expect(desktopColumns(744)).toMatchObject({ count: 2, columnWidth: 372 })
    expect(desktopColumns(1080)).toMatchObject({ count: 3, columnWidth: 360 })
    expect(desktopColumns(3440)).toMatchObject({ count: 3, columnWidth: 480 })
  })
})

const icon = { width: 1, height: 1 }
const small = { width: 2, height: 2 }
const wide = { width: 4, height: 2 }
const large = { width: 4, height: 4 }

describe('packColumn', () => {
  it('按顺序往后放，放不下就换行，不回头填前面的空', () => {
    const { placements, rows } = packColumn([icon, icon, icon, wide, small, icon])
    expect(placements.map(({ row, column }) => [row, column])).toEqual([[0, 0], [0, 1], [0, 2], [1, 0], [3, 0], [3, 2]])
    expect(rows).toBe(5)
  })
})

describe('splitColumns', () => {
  it('按顺序切段，让最高的一栏尽量矮', () => {
    expect(splitColumns([wide, wide, wide, wide], 2)).toEqual([0, 2])
    expect(splitColumns([large, wide, wide], 2)).toEqual([0, 1])
    expect(splitColumns([wide, large, wide, small, small], 3)).toEqual([0, 1, 2])
  })

  it('一样矮时让前面的栏多放', () => {
    expect(splitColumns([wide, wide, wide], 2)).toEqual([0, 2])
  })

  it('内容比栏少时后面的栏空着', () => {
    expect(splitColumns([wide], 3)).toEqual([0, 1, 1])
  })
})

describe('allowedLayouts', () => {
  it('分屏时每个窗口至少 360 宽、480 高，手机横竖都不能分屏', () => {
    expect(allowedLayouts({ width: 440, height: 860 })).toEqual(['1'])
    expect(allowedLayouts({ width: 832, height: 419 })).toEqual(['1'])
  })

  it('横屏左右分，竖屏上下分', () => {
    expect(allowedLayouts({ width: 890, height: 576 })).toEqual(['1', '1:2', '2:1'])
    expect(allowedLayouts({ width: 576, height: 890 })).toEqual(['1'])
    expect(allowedLayouts({ width: 744, height: 1089 })).toEqual(['1', '1:2', '2:1'])
    expect(allowedLayouts({ width: 1092, height: 600 })).toEqual(['1', '1:1', '1:2', '2:1'])
    expect(allowedLayouts({ width: 1032, height: 1452 })).toEqual(['1', '1:1', '1:2', '2:1'])
  })

  it('窗口之间的缝不算在窗口的尺寸里', () => {
    expect(allowedLayouts({ width: 720, height: 600 })).toEqual(['1'])
    expect(allowedLayouts({ width: 726, height: 600 })).toEqual(['1', '1:2', '2:1'])
    expect(allowedLayouts({ width: 1080, height: 600 })).toEqual(['1', '1:2', '2:1'])
  })
})

describe('fitLayout', () => {
  it('均分不可用时保留聚焦窗口的大区域，放不下时降为一个', () => {
    expect(fitLayout('1:1', ['1', '1:2', '2:1'])).toBe('2:1')
    expect(fitLayout('1:1', ['1', '1:2', '2:1'], 1)).toBe('1:2')
    expect(fitLayout('1:2', ['1'])).toBe('1')
    expect(fitLayout('2:1', ['1', '1:1', '1:2', '2:1'])).toBe('2:1')
  })
})

describe('normalizeWorkspace', () => {
  it('去掉已经关掉的窗口，补齐两个位置并取消不完整分屏', () => {
    expect(normalizeWorkspace({ layout: '1:1', slots: ['a', 'gone'] }, ['a', 'b'])).toEqual({ layout: '1', slots: ['a', null] })
    expect(normalizeWorkspace(null, [])).toEqual({ layout: '1', slots: [null, null] })
  })
})

describe('arrange', () => {
  const workspace = { layout: '1:1' as const, slots: ['a', 'b'] }

  it('降级后按位置取前面的窗口', () => {
    expect(arrange(workspace, '1:1', 'c')).toEqual(['a', 'b'])
  })

  it('只有一个位置时显示本设备聚焦的窗口', () => {
    expect(arrange(workspace, '1', 'c')).toEqual(['c'])
    expect(arrange(workspace, '1', null)).toEqual(['a'])
  })
})

describe('place', () => {
  it('已经在别的位置上时对调', () => {
    expect(place({ layout: '1:1', slots: ['a', 'b'] }, 'b', 0).slots).toEqual(['b', 'a'])
    expect(place({ layout: '1:1', slots: ['a', 'b'] }, 'c', 1).slots).toEqual(['a', 'c'])
  })
})

describe('分屏尺寸和吸附', () => {
  it('小窗口固定最小尺寸，大窗口占剩余空间', () => {
    expect(paneSizes('1:2', { width: 1600, height: 900 })).toEqual([{ width: 360, height: 900 }, { width: 1234, height: 900 }])
    expect(paneSizes('2:1', { width: 800, height: 1600 })).toEqual([{ width: 800, height: 1114 }, { width: 800, height: 480 }])
  })

  it('按当前方向吸附到最近的三个位置', () => {
    expect(snapLayout(400, 1600, 360)).toBe('1:2')
    expect(snapLayout(800, 1600, 360)).toBe('1:1')
    expect(snapLayout(1200, 1600, 360)).toBe('2:1')
    expect(snapLayout(500, 1600, 480)).toBe('1:2')
  })

  it('旧三窗口布局和重复窗口不会恢复为分屏', () => {
    expect(normalizeWorkspace({ layout: '1:1:1', slots: ['a', 'b', 'c'] }, ['a', 'b', 'c'])).toEqual({ layout: '1', slots: ['a', 'b'] })
    expect(normalizeWorkspace({ layout: '1:1', slots: ['a', 'a'] }, ['a'])).toEqual({ layout: '1', slots: ['a', 'a'] })
  })
})

describe('均分门槛', () => {
  it('左右分屏扣除分割线后需容纳三个最小宽度', () => {
    expect(allowedLayouts({ width: 1085, height: 600 })).not.toContain('1:1')
    expect(allowedLayouts({ width: 1086, height: 600 })).toContain('1:1')
    expect(paneSizes('1:2', { width: 900, height: 600 }).map((size) => size.width)).toEqual([360, 534])
    expect(snapLayout(449, 900, 360)).toBe('1:2')
    expect(snapLayout(451, 900, 360)).toBe('2:1')
  })

  it('上下分屏扣除分割线后需容纳三个最小高度', () => {
    expect(allowedLayouts({ width: 800, height: 965 })).toEqual(['1'])
    expect(allowedLayouts({ width: 800, height: 966 })).toEqual(['1', '1:2', '2:1'])
    expect(allowedLayouts({ width: 800, height: 1445 })).not.toContain('1:1')
    expect(allowedLayouts({ width: 800, height: 1446 })).toContain('1:1')
    expect(snapLayout(599, 1200, 480)).toBe('1:2')
    expect(snapLayout(601, 1200, 480)).toBe('2:1')
  })
})

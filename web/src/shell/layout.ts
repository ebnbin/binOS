import type { JsonValue } from '@binos/server/types'

// 桌面分栏和窗口分屏的规格，只做计算，不读写系统状态

export type Size = { width: number; height: number }

// 桌面一栏宽 360～480，放 4 个图标格；最多 3 栏，再宽的空间平分到左右两边
export const column = { min: 360, max: 480, maxCount: 3 }

export function desktopColumns(width: number) {
  const count = Math.max(1, Math.min(column.maxCount, Math.floor(width / column.min)))
  const columnWidth = Math.min(width / count, column.max)
  return { count, columnWidth, scale: columnWidth / column.min }
}

// 一栏宽 4 格
export const columnCells = 4

export type Placement = { row: number; column: number; width: number; height: number }

// 按顺序放进一栏：每一个从上一个的后面开始，找第一个放得下的位置，不回头填前面的空，所以顺序不会变
export function packColumn(sizes: Size[]): { placements: Placement[]; rows: number } {
  const taken: boolean[][] = []
  const free = (row: number, col: number, size: Size) => {
    for (let r = row; r < row + size.height; r++) {
      for (let c = col; c < col + size.width; c++) {
        if (taken[r]?.[c]) {
          return false
        }
      }
    }
    return true
  }
  let cursor = { row: 0, column: 0 }
  let rows = 0
  const placements = sizes.map((size) => {
    let { row, column: col } = cursor
    while (col + size.width > columnCells || !free(row, col, size)) {
      col += 1
      if (col + size.width > columnCells) {
        row += 1
        col = 0
      }
    }
    for (let r = row; r < row + size.height; r++) {
      taken[r] ??= []
      for (let c = col; c < col + size.width; c++) {
        taken[r][c] = true
      }
    }
    cursor = { row, column: col + size.width }
    rows = Math.max(rows, row + size.height)
    return { row, column: col, width: size.width, height: size.height }
  })
  return { placements, rows }
}

// 按顺序把内容切成 count 段，第 1 段放第 1 栏，依次往右。
// 选最高的那一栏最矮的切法，这样各栏一样高，放不下时整个桌面一起滚动；
// 一样矮时选空格最少的，再一样时让前面的栏多放
export function splitColumns(sizes: Size[], count: number): number[] {
  const rows = new Map<string, number>()
  const rowsOf = (start: number, end: number) => {
    const key = `${start}-${end}`
    if (!rows.has(key)) {
      rows.set(key, packColumn(sizes.slice(start, end)).rows)
    }
    return rows.get(key)!
  }
  const best: { starts: number[]; heights: number[] | null } = { starts: [0], heights: null }
  const better = (heights: number[], than: number[]) => {
    const key = (list: number[]) => [Math.max(...list), list.reduce((sum, value) => sum + value, 0), ...list.map((value) => -value)]
    const a = key(heights)
    const b = key(than)
    const index = a.findIndex((value, i) => value !== b[i])
    return index >= 0 && a[index] < b[index]
  }
  const search = (starts: number[]) => {
    if (starts.length === count) {
      const bounds = [...starts, sizes.length]
      const heights = starts.map((start, index) => rowsOf(start, bounds[index + 1]))
      if (!best.heights || better(heights, best.heights)) {
        best.starts = starts
        best.heights = heights
      }
      return
    }
    for (let start = starts.at(-1)!; start <= sizes.length; start++) {
      search([...starts, start])
    }
  }
  search([0])
  return best.starts
}

// 窗口只能按这几种比例分屏：横屏左右分，竖屏上下分
export type LayoutId = '1' | '1:1' | '1:2' | '2:1' | '1:1:1'
export const layouts: Record<LayoutId, number[]> = {
  '1': [1],
  '1:1': [1, 1],
  '1:2': [1, 2],
  '2:1': [2, 1],
  '1:1:1': [1, 1, 1],
}
export const layoutIds = Object.keys(layouts) as LayoutId[]
export const maxPanes = 3

// 分屏时每个窗口至少这么大；只有一个窗口时不限制
export const minPane = { width: 360, height: 480 }

export const isPortrait = (size: Size) => size.height > size.width

export function paneSizes(layout: LayoutId, size: Size): Size[] {
  const parts = layouts[layout]
  const total = parts.reduce((sum, part) => sum + part, 0)
  return parts.map((part) =>
    isPortrait(size) ? { width: size.width, height: (size.height * part) / total } : { width: (size.width * part) / total, height: size.height },
  )
}

export function allowedLayouts(size: Size): LayoutId[] {
  return layoutIds.filter(
    (id) => id === '1' || paneSizes(id, size).every((pane) => pane.width >= minPane.width && pane.height >= minPane.height),
  )
}

// 放不下时降级：多个窗口先降为平分，再降为一个
export function fitLayout(layout: LayoutId, allowed: LayoutId[]): LayoutId {
  if (allowed.includes(layout)) {
    return layout
  }
  return layouts[layout].length > 1 && allowed.includes('1:1') ? '1:1' : '1'
}

// 系统状态 shell/workspace：选的分屏布局和每个位置上的窗口 id，所有设备共用
export type Workspace = { layout: LayoutId; slots: (string | null)[] }

export function normalizeWorkspace(value: JsonValue, ids: string[]): Workspace {
  const stored = value as Partial<Workspace> | null
  const layout = stored?.layout && stored.layout in layouts ? stored.layout : '1'
  const slots = Array.from({ length: maxPanes }, (_, index) => {
    const id = stored?.slots?.[index]
    return id && ids.includes(id) ? id : null
  })
  return { layout, slots }
}

// 实际显示的窗口。只有一个位置时显示本设备聚焦的窗口，不动共用的布局；分屏时按共用的位置
export function arrange(workspace: Workspace, layout: LayoutId, focused: string | null): (string | null)[] {
  const count = layouts[layout].length
  if (count === 1) {
    return [focused ?? workspace.slots.find((id) => id !== null) ?? null]
  }
  return workspace.slots.slice(0, count)
}

// 换成分屏布局时，聚焦的窗口一定在里面，空位用最近用过的窗口补上
export function relayout(workspace: Workspace, layout: LayoutId, focused: string | null, recent: string[]): Workspace {
  const count = layouts[layout].length
  if (count === 1) {
    return { ...workspace, layout }
  }
  const slots = [...workspace.slots]
  if (focused && !slots.slice(0, count).includes(focused)) {
    const empty = slots.slice(0, count).indexOf(null)
    slots[empty >= 0 ? empty : 0] = focused
  }
  for (const id of recent) {
    const empty = slots.slice(0, count).indexOf(null)
    if (empty < 0) {
      break
    }
    if (!slots.slice(0, count).includes(id)) {
      slots[empty] = id
    }
  }
  // 同一个窗口只出现一次，前面的位置优先
  return { layout, slots: slots.map((id, index) => (id && slots.indexOf(id) === index ? id : null)) }
}

// 把窗口放到某个位置；它已经在别的位置上时，和原来的窗口对调
export function place(workspace: Workspace, id: string, slot: number): Workspace {
  const slots = [...workspace.slots]
  const from = slots.indexOf(id)
  if (from >= 0) {
    slots[from] = slots[slot]
  }
  slots[slot] = id
  return { ...workspace, slots }
}

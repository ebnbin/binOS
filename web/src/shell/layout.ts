import type { JsonValue } from '@binos/server/types'

export type Size = { width: number; height: number }

// 横屏左右分，竖屏上下分；不均分时较小窗口固定为最小尺寸。
export type LayoutId = '1' | '1:1' | '1:2' | '2:1'
export const layouts: Record<LayoutId, number[]> = {
  '1': [1],
  '1:1': [1, 1],
  '1:2': [1, 2],
  '2:1': [2, 1],
}
export const layoutIds = Object.keys(layouts) as LayoutId[]
export const maxPanes = 2

// 分屏时每个窗口至少这么大；只有一个窗口时不限制
export const minPane = 360
// 窗口间分割区域不占窗口自己的尺寸
export const paneGap = 6
// 两种不均分布局之间至少留出 90px 的拖动距离
const splitBuffer = 90

export const isPortrait = (size: Size) => size.height > size.width

function canEqualSplit(length: number) {
  return length - paneGap >= minPane * 3
}

export function snapLayout(position: number, length: number): LayoutId {
  const available = length - paneGap
  const positions: [LayoutId, number][] = [
    ['1:2', minPane],
    ['1:1', available / 2],
    ['2:1', available - minPane],
  ]
  const candidates = positions.filter(([id]) => id !== '1:1' || canEqualSplit(length))
  return candidates.reduce((best, option) =>
    Math.abs(option[1] + paneGap / 2 - position) < Math.abs(best[1] + paneGap / 2 - position) ? option : best,
  )[0]
}

export function paneSizes(layout: LayoutId, size: Size): Size[] {
  if (layout === '1') return [size]
  const portrait = isPortrait(size)
  const available = (portrait ? size.height : size.width) - paneGap
  const first = layout === '1:2' ? minPane : layout === '2:1' ? available - minPane : available / 2
  return [first, available - first].map((length) =>
    portrait ? { width: size.width, height: length } : { width: length, height: size.height },
  )
}

export function allowedLayouts(size: Size): LayoutId[] {
  const portrait = isPortrait(size)
  const length = portrait ? size.height : size.width
  if (length < minPane * 2 + paneGap + splitBuffer) return ['1']
  const equal = canEqualSplit(length)
  return layoutIds.filter(
    (id) => id === '1' || ((id !== '1:1' || equal) && paneSizes(id, size).every((pane) => pane.width >= minPane && pane.height >= minPane)),
  )
}

// 均分不可用时让指定位置占较大区域；分屏放不下时降为一个
export function fitLayout(layout: LayoutId, allowed: LayoutId[], preferred = 0): LayoutId {
  if (allowed.includes(layout)) {
    return layout
  }
  if (layout === '1') return '1'
  const fallback = preferred === 1 ? '1:2' : '2:1'
  return allowed.includes(fallback) ? fallback : '1'
}

// 选的分屏布局和每个位置上的窗口 id（见 windows.ts）
export type Workspace = { layout: LayoutId; slots: (string | null)[] }

export function normalizeWorkspace(value: JsonValue, ids: string[]): Workspace {
  const stored = value as Partial<Workspace> | null
  const layout = stored?.layout && stored.layout in layouts ? stored.layout : '1'
  const slots = Array.from({ length: maxPanes }, (_, index) => {
    const id = stored?.slots?.[index]
    return id && ids.includes(id) && stored?.slots?.indexOf(id) === index ? id : null
  })
  return { layout: layout !== '1' && slots.every((id) => id === null) ? '1' : layout, slots }
}

// 实际显示的窗口。只有一个位置时显示聚焦的窗口，不动记下的布局；分屏时按记下的位置
export function arrange(workspace: Workspace, layout: LayoutId, focused: string | null): (string | null)[] {
  const count = layouts[layout].length
  if (count === 1) {
    return [focused ?? workspace.slots.find((id) => id !== null) ?? null]
  }
  return workspace.slots.slice(0, count)
}

export type SplitGroup = Workspace & { id: string; slots: [string, string] }

export function normalizeGroups(value: JsonValue, ids: string[]): SplitGroup[] {
  if (!Array.isArray(value)) return []
  const used = new Set<string>()
  const groupIds = new Set<string>()
  return value.flatMap((item) => {
    const workspace = normalizeWorkspace(item, ids)
    const id = (item as { id?: string } | null)?.id
    const [first, second] = workspace.slots
    if (typeof id !== 'string' || groupIds.has(id) || workspace.layout === '1' || !first || !second || used.has(first) || used.has(second))
      return []
    used.add(first)
    used.add(second)
    groupIds.add(id)
    return [{ id, layout: workspace.layout, slots: [first, second] as [string, string] }]
  })
}

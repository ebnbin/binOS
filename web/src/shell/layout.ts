// 窗口的层级和位置计算，不读写系统状态

export type Form = 'desktop' | 'mobile'
export type Frame = { x: number; y: number; w: number; h: number; minimized: boolean; maximized: boolean }
// stack：从下到上的窗口 id。focused 为 null 时没有聚焦的窗口：桌面上是点了空白处，手机上是在主屏
export type Focus = { stack: string[]; focused: string | null }
// 窗口可以摆放的区域，在页面坐标里
export type Area = { top: number; width: number; height: number }

export const minSize = { width: 320, height: 200 }
// 窗口至少露出这么多，才拖得回来
const visible = { width: 120, titleBar: 36 }

// 手机竖屏，或者高度放不下窗口的横屏
export function formFor(width: number, height: number): Form {
  return width < 640 || height < 500 ? 'mobile' : 'desktop'
}

// 去掉已经关掉的窗口；别的设备新开的窗口放在最下面，不抢聚焦
export function normalizeFocus(focus: Focus | null, ids: string[]): Focus {
  const known = (focus?.stack ?? []).filter((id) => ids.includes(id))
  const focused = focus?.focused && ids.includes(focus.focused) ? focus.focused : null
  return { stack: [...ids.filter((id) => !known.includes(id)), ...known], focused }
}

export function raise(focus: Focus, id: string): Focus {
  return { stack: [...focus.stack.filter((item) => item !== id), id], focused: id }
}

export function clampFrame(frame: Frame, area: Area): Frame {
  const w = Math.max(minSize.width, Math.min(frame.w, area.width))
  const h = Math.max(minSize.height, Math.min(frame.h, area.height))
  const x = Math.min(Math.max(frame.x, visible.width - w), area.width - visible.width)
  const y = Math.min(Math.max(frame.y, area.top), area.top + area.height - visible.titleBar)
  return { ...frame, x, y, w, h }
}

// 新窗口居中，已经有窗口时依次错开
export function placeFrame(size: { width: number; height: number }, area: Area, count: number): Frame {
  const w = Math.min(size.width, area.width - 32)
  const h = Math.min(size.height, area.height - 32)
  const offset = (count % 6) * 28
  const frame = {
    x: Math.round((area.width - w) / 2) + offset,
    y: area.top + Math.round((area.height - h) / 2) + offset,
    w,
    h,
    minimized: false,
    maximized: false,
  }
  return clampFrame(frame, area)
}

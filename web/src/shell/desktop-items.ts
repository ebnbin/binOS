import type { JsonValue } from '@binos/server/types'
import { findApp } from '../apps/index.ts'
import type { WidgetSize } from '../apps/types.ts'

// 系统状态 shell/desktop → DesktopItem[][]：桌面上的几组内容，所有设备共用。
// 每一组固定 4 格宽，换设备时组内不会重排，屏幕只决定分成几栏
export type DesktopItem = { app: string } | { app: string; widget: string; size: WidgetSize }

export const desktopKey = 'shell/desktop'

const defaultDesktop: DesktopItem[][] = [
  [
    { app: 'system', widget: 'status', size: '4x2' },
    { app: 'agent' },
    { app: 'system' },
    { app: 'notes' },
    { app: 'calendar' },
    { app: 'weather' },
    { app: 'music' },
    { app: 'files' },
    { app: 'agent', widget: 'recent', size: '4x2' },
  ],
  [
    { app: 'calendar', widget: 'main', size: '4x4' },
    { app: 'weather', widget: 'main', size: '2x2' },
    { app: 'music', widget: 'main', size: '2x2' },
  ],
  [
    { app: 'notes', widget: 'main', size: '4x2' },
    { app: 'files', widget: 'main', size: '2x2' },
    { app: 'weather', widget: 'main', size: '2x2' },
  ],
]

// 去掉已经没有的 app、widget 和不支持的尺寸
export function readDesktop(value: JsonValue): DesktopItem[][] {
  const columns = Array.isArray(value) ? (value as DesktopItem[][]) : defaultDesktop
  return columns.map((items) =>
    items.filter((item) => {
      const app = findApp(item.app)
      if (!app || !('widget' in item)) {
        return Boolean(app)
      }
      return app.widgets?.[item.widget]?.sizes.includes(item.size) ?? false
    }),
  )
}

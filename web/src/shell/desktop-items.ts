import type { JsonValue } from '@binos/server/types'
import { findApp } from '../apps/index.ts'
import type { AppManifest, WidgetSize } from '../apps/types.ts'

// 系统状态 shell/desktop → DesktopItem[]：桌面上按顺序放的图标和 widget，所有设备共用。
// 顺序固定，屏幕只决定分成几栏、每栏放到哪一个
export type DesktopItem = { app: string } | { app: string; widget: string; size: WidgetSize }

export const desktopKey = 'shell/desktop'

// 外部 app 的图标排在系统 app 后面
const defaultDesktop = (apps: AppManifest[]): DesktopItem[] => [
  { app: 'system', widget: 'status', size: '4x2' },
  { app: 'kita' },
  { app: 'system' },
  ...apps.filter((app) => app.url).map((app) => ({ app: app.id })),
  { app: 'notes' },
  { app: 'calendar' },
  { app: 'weather' },
  { app: 'music' },
  { app: 'files' },
  { app: 'kita', widget: 'recent', size: '4x2' },
  { app: 'calendar', widget: 'main', size: '4x4' },
  { app: 'weather', widget: 'main', size: '2x2' },
  { app: 'music', widget: 'main', size: '2x2' },
  { app: 'notes', widget: 'main', size: '4x2' },
  { app: 'files', widget: 'main', size: '2x2' },
  { app: 'weather', widget: 'main', size: '2x2' },
]

// 去掉已经没有的 app、widget 和不支持的尺寸
export function readDesktop(value: JsonValue, apps: AppManifest[]): DesktopItem[] {
  const items = Array.isArray(value) ? (value as DesktopItem[]) : defaultDesktop(apps)
  return items.filter((item) => {
    const app = findApp(apps, item.app)
    if (!app || !('widget' in item)) {
      return Boolean(app)
    }
    return app.widgets?.[item.widget]?.sizes.includes(item.size) ?? false
  })
}

// 占几格，宽 × 高
export function itemSize(item: DesktopItem) {
  if (!('widget' in item)) {
    return { width: 1, height: 1 }
  }
  const [width, height] = item.size.split('x').map(Number)
  return { width, height }
}

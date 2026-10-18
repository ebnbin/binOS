import type { LucideIcon } from 'lucide-react'
import type { ComponentType } from 'react'

export type AppManifest = {
  id: string
  name: string
  icon: LucideIcon
  // 独立部署的 web app 的网址，来自系统状态里的清单
  url?: string
  component: ComponentType<{ ctx: AppContext }>
  // 放在桌面上的 widget，键是 widget 的 id
  widgets?: Record<string, WidgetManifest>
}

// app 只通过它和 Shell 打交道，不知道自己是占满屏幕还是分屏。route 是 app 内部的路由，由 app 自己解释
export type AppContext = {
  route: string
  navigate(route: string, options?: { replace?: boolean }): void
  // 回到这个窗口的上一页，没有上一页时回到 app 的首页
  back(): void
  setTitle(title: string): void
}

// 桌面上的格子数，宽 × 高。一栏宽 4 格
export type WidgetSize = '2x2' | '4x2' | '4x4'

export type WidgetManifest = {
  name: string
  sizes: WidgetSize[]
  component: ComponentType<WidgetProps>
}

// widget 只显示 app 的数据，不自己保存状态；open 打开 app，可以直接到某一页
export type WidgetProps = {
  size: WidgetSize
  open(route?: string): void
}

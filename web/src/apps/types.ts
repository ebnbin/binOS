import type { ComponentType, LazyExoticComponent } from 'react'

export type AppManifest = {
  id: string
  name: string
  component: LazyExoticComponent<ComponentType<{ ctx: AppContext }>>
}

// app 只通过它和 Shell 打交道，不知道自己显示在哪里。route 是 app 内部的路由，由 app 自己解释
export type AppContext = {
  route: string
  navigate(route: string, options?: { replace?: boolean }): void
  // 上一页也是 binOS 的就后退，否则回到 app 的首页
  back(): void
  setTitle(title: string): void
}

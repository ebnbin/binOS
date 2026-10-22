import type { Hono } from 'hono'

// 有后端的内置 app。api 挂在 /api/apps/<id> 下，start 在后端启动时调用
export type ServerApp = {
  id: string
  // 各个 app 的路由类型不同，页面直接用 app 自己导出的类型
  api: Hono<any, any, any>
  start?(): void
  stop?(): void | Promise<void>
}

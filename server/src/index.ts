import { existsSync } from 'node:fs'
import path from 'node:path'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import type { Context } from 'hono'
import { api } from './api.js'
import { codeDir, libraryDir } from './paths.js'
import { acquireProcessLock } from './process.js'
import { resumeTurns } from './turns.js'

// 一个根目录的数据只能由一个后端读写：两个后端会同时跟进同一轮回答，重复写入记录
const holder = acquireProcessLock(path.join(libraryDir, 'server.lock'))
if (holder) {
  throw new Error(`根目录 ${path.dirname(libraryDir)} 已有后端在运行（进程 ${holder.pid}）`)
}
resumeTurns()

const app = new Hono().route('/', api)

// 正式版由后端提供前端构建出的页面；开发时页面由 Vite 提供，没有 web/dist
const webDist = path.join(codeDir, 'web', 'dist')
if (existsSync(webDist)) {
  // 文件名带内容哈希的资源可以长期缓存，index.html 每次都要重新取，才能拿到新版本
  const setCache = (file: string, c: Context) =>
    c.header('Cache-Control', file.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache')
  app.use('*', serveStatic({ root: webDist, onFound: setCache }))
  // 单页应用：接口以外找不到的路径都返回 index.html
  const index = serveStatic({ path: path.join(webDist, 'index.html'), onFound: setCache })
  app.use('*', (c, next) => (c.req.path.startsWith('/api/') ? next() : index(c, next)))
}

const port = Number(process.env.PORT ?? 3000)
serve({ fetch: app.fetch, hostname: '127.0.0.1', port }, (info) => {
  console.log(`binOS 后端已启动：http://127.0.0.1:${info.port}`)
})

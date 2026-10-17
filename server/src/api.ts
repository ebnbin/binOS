import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'
import { streamSSE } from 'hono/streaming'
import { validator } from 'hono/validator'
import { requireOwner } from './access.js'
import { agentApi } from './apps/agent/api.js'
import { onChange } from './events.js'
import { codeDir } from './paths.js'
import { connectedPreamble, keepAlive } from './sse.js'
import { applyChanges, parseChanges, readState } from './state.js'
import type { ChangeEvent } from './types.js'

// VERSION 由上线脚本写进构建目录，开发时没有
const versionFile = path.join(codeDir, 'VERSION')
const version = existsSync(versionFile) ? readFileSync(versionFile, 'utf8').trim() : 'dev'

// 写操作只接受 JSON 和上传文件用的 octet-stream：浏览器跨站提交这两种都需要预检，其他网站无法借你的登录状态发起请求
const requirePreflight: MiddlewareHandler = async (c, next) => {
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD' && !/^application\/(json|octet-stream)(;|$)/.test(c.req.header('Content-Type') ?? '')) {
    return c.text('Unsupported Media Type', 415)
  }
  await next()
}

const stateBody = validator('json', (value, c) => {
  const changes = parseChanges((value as { changes?: unknown } | null)?.changes)
  if (!changes) {
    return c.text('Bad Request', 400)
  }
  return { changes }
})

export const api = new Hono()
  .basePath('/api')
  // 上线脚本在本机检查它，拿不到 Access 凭证，所以注册在身份校验之前
  .get('/health', (c) => c.json({ version }))
  .use(requireOwner, requirePreflight)
  .get('/state', (c) => c.json(readState()))
  .post('/state', stateBody, (c) => c.json({ version: applyChanges(c.req.valid('json').changes) }, 200))
  .route('/apps/agent', agentApi)
  // 页面只连这一条全局通知；断线重连后页面会全部重新读取，这里不补发
  .get('/events', (c) =>
    streamSSE(c, async (stream) => {
      await stream.write(connectedPreamble)
      const send = (event: ChangeEvent) => void stream.writeSSE({ data: JSON.stringify(event) })
      stream.onAbort(onChange(send))
      await keepAlive(stream)
    }),
  )

export type AppType = typeof api

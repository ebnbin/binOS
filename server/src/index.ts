import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import type { Context } from 'hono'
import { streamSSE } from 'hono/streaming'
import { requireOwner } from './access.js'
import { isAnswering, liveState, resumeTurns, startTurn, stopTurn, subscribe } from './agent.js'
import { acquireRootLock } from './lock.js'
import { codeDir } from './paths.js'
import { imagesDir, listSessions, readTranscript, sessionExists, sessionSummary } from './sessions.js'

acquireRootLock()
resumeTurns()

const app = new Hono()

// 当前运行的版本：正式版的构建里有 VERSION 文件，开发时没有。
// 上线脚本在本机检查它，拿不到 Access 凭证，所以注册在身份校验之前
const versionFile = path.join(codeDir, 'VERSION')
const version = existsSync(versionFile) ? readFileSync(versionFile, 'utf8').trim() : 'dev'
app.get('/api/health', (c) => c.json({ version }))

app.use('/api/*', requireOwner)

// 只接受 JSON：浏览器跨站提交 JSON 需要预检，其他网站无法借你的登录状态发起请求
async function readText(c: Context): Promise<string | undefined> {
  if (c.req.header('Content-Type') !== 'application/json') {
    return undefined
  }
  const { text } = await c.req.json()
  return typeof text === 'string' && text.trim() ? text : undefined
}

function start(c: Context, sessionId: number | undefined, text: string | undefined) {
  if (!text) {
    return c.text('Bad Request', 400)
  }
  const id = startTurn(sessionId, text)
  if (id === undefined) {
    return c.json({ error: 'busy' }, 409)
  }
  return c.json({ id })
}

// 所有 session 的概要，新的在前
app.get('/api/sessions', (c) => {
  const sessions = listSessions()
    .filter(sessionExists)
    .map((id) => ({ ...sessionSummary(id), running: isAnswering(id) }))
  return c.json({ sessions })
})

app.post('/api/sessions', async (c) => start(c, undefined, await readText(c)))

app.post('/api/sessions/:id/messages', async (c) => {
  const id = Number(c.req.param('id'))
  if (!sessionExists(id)) {
    return c.text('Not Found', 404)
  }
  return start(c, id, await readText(c))
})

app.post('/api/sessions/:id/stop', (c) => {
  if (c.req.header('Content-Type') !== 'application/json') {
    return c.text('Unsupported Media Type', 415)
  }
  if (!stopTurn(Number(c.req.param('id')))) {
    return c.text('Not Found', 404)
  }
  return c.json({ ok: true })
})

// session 里保存的图片。文件名由后端生成，内容不会变
const imageTypes: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' }
app.get('/api/sessions/:id/images/:file', (c) => {
  const id = Number(c.req.param('id'))
  const match = /^[\w-]+\.(\w+)$/.exec(c.req.param('file'))
  const type = match && imageTypes[match[1]]
  const file = path.join(imagesDir(id), c.req.param('file'))
  if (!sessionExists(id) || !type || !existsSync(file)) {
    return c.text('Not Found', 404)
  }
  return c.body(readFileSync(file), 200, { 'Content-Type': type, 'Cache-Control': 'private, max-age=31536000, immutable' })
})

// 先补发第 from 条及之后的条目，再推送实时事件
app.get('/api/sessions/:id/stream', (c) => {
  const id = Number(c.req.param('id'))
  if (!sessionExists(id)) {
    return c.text('Not Found', 404)
  }
  const from = Number(c.req.query('from') ?? 0)
  return streamSSE(c, async (stream) => {
    const send = (data: unknown) => void stream.writeSSE({ data: JSON.stringify(data) })
    // 读取记录、发出补发内容、开始监听之间没有等待，不会漏掉或重复条目
    await stream.write(': connected\n\n')
    readTranscript(id).forEach((entry, index) => {
      if (index >= from) {
        send({ type: 'entry', index, entry })
      }
    })
    liveState(id).forEach(send)
    const unsubscribe = subscribe(id, send)
    stream.onAbort(unsubscribe)
    // Cloudflare 会断开长时间没有数据的连接
    while (!stream.aborted) {
      await stream.sleep(15000)
      await stream.write(': ping\n\n')
    }
  })
})

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

serve({
  fetch: app.fetch,
  hostname: '127.0.0.1',
  port: Number(process.env.PORT ?? 3000)
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'
import { streamSSE } from 'hono/streaming'
import { validator } from 'hono/validator'
import { requireOwner } from './access.js'
import { subscribe } from './events.js'
import { codeDir } from './paths.js'
import { filesDir, listSessions, readTranscript, sessionExists, sessionSummary } from './sessions.js'
import { isAnswering, liveState, startTurn, stopTurn } from './turns.js'
import type { LiveEvent, SessionSummary } from './types.js'

// 当前运行的版本：正式版的构建里有 VERSION 文件，开发时没有
const versionFile = path.join(codeDir, 'VERSION')
const version = existsSync(versionFile) ? readFileSync(versionFile, 'utf8').trim() : 'dev'

// 写操作只接受 JSON：浏览器跨站提交 JSON 需要预检，其他网站无法借你的登录状态发起请求
const requireJson: MiddlewareHandler = async (c, next) => {
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD' && !/^application\/json(;|$)/.test(c.req.header('Content-Type') ?? '')) {
    return c.text('Unsupported Media Type', 415)
  }
  await next()
}

// 路径里的 session 编号，不存在时返回 404
const sessionParam = validator('param', (value: Record<string, string>, c) => {
  const id = Number(value.id)
  if (!sessionExists(id)) {
    return c.text('Not Found', 404)
  }
  return { id }
})

const messageBody = validator('json', (value: { text: string }, c) => {
  const text = (value as { text?: unknown } | null)?.text
  if (typeof text !== 'string' || !text.trim()) {
    return c.text('Bad Request', 400)
  }
  return { text }
})

// session 的 files/ 里可以提供的文件类型。文件名由后端生成，内容不会变
const fileTypes: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' }

// 开始一轮回答，sessionId 为空时新建 session
function start(sessionId: number | undefined, text: string) {
  const id = startTurn(sessionId, text)
  return id === undefined ? ({ error: 'busy' } as const) : { id }
}

export const api = new Hono()
  .basePath('/api')
  // 上线脚本在本机检查它，拿不到 Access 凭证，所以注册在身份校验之前
  .get('/health', (c) => c.json({ version }))
  .use(requireOwner, requireJson)
  // 所有 session 的概要，新的在前
  .get('/sessions', (c) => {
    const sessions: SessionSummary[] = listSessions().map((id) => ({ ...sessionSummary(id), running: isAnswering(id) }))
    return c.json({ sessions })
  })
  .post('/sessions', messageBody, (c) => {
    const result = start(undefined, c.req.valid('json').text)
    return 'id' in result ? c.json(result, 200) : c.json(result, 409)
  })
  .post('/sessions/:id/messages', sessionParam, messageBody, (c) => {
    const result = start(c.req.valid('param').id, c.req.valid('json').text)
    return 'id' in result ? c.json(result, 200) : c.json(result, 409)
  })
  .post('/sessions/:id/stop', sessionParam, (c) => {
    if (!stopTurn(c.req.valid('param').id)) {
      return c.text('Not Found', 404)
    }
    return c.json({ ok: true }, 200)
  })
  .get('/sessions/:id/files/:file', sessionParam, (c) => {
    const name = c.req.param('file')
    const match = /^[\w-]+\.(\w+)$/.exec(name)
    const type = match && fileTypes[match[1]]
    const file = path.join(filesDir(c.req.valid('param').id), name)
    if (!type || !existsSync(file)) {
      return c.text('Not Found', 404)
    }
    return c.body(readFileSync(file), 200, { 'Content-Type': type, 'Cache-Control': 'private, max-age=31536000, immutable' })
  })
  // 实时推送：先补发条目，再推送实时事件。条目的事件 id 是到它为止的条数，
  // 浏览器断线重连时带上 Last-Event-ID，从那之后接着补发；也可以用 from 参数指定
  .get('/sessions/:id/stream', sessionParam, (c) => {
    const id = c.req.valid('param').id
    const from = Number(c.req.header('Last-Event-ID') ?? c.req.query('from') ?? 0) || 0
    return streamSSE(c, async (stream) => {
      const send = (event: LiveEvent) =>
        void stream.writeSSE({
          data: JSON.stringify(event),
          id: event.type === 'entry' ? String(event.index + 1) : undefined,
        })
      // 读取记录、补发、开始监听之间没有等待，不会漏掉或重复条目
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

export type AppType = typeof api

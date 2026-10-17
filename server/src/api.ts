import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'
import { streamSSE } from 'hono/streaming'
import type { SSEStreamingApi } from 'hono/streaming'
import { validator } from 'hono/validator'
import { requireOwner } from './access.js'
import { onSessionChanged, subscribe } from './events.js'
import { codeDir } from './paths.js'
import { filesDir, listSessions, readTranscript, sessionExists, sessionSummary } from './sessions.js'
import { isAnswering, liveState, startTurn, stopTurn } from './turns.js'
import type { ChangeEvent, LiveEvent, SessionSummary } from './types.js'

// VERSION 由上线脚本写进构建目录，开发时没有
const versionFile = path.join(codeDir, 'VERSION')
const version = existsSync(versionFile) ? readFileSync(versionFile, 'utf8').trim() : 'dev'

// 写操作只接受 JSON：浏览器跨站提交 JSON 需要预检，其他网站无法借你的登录状态发起请求
const requireJson: MiddlewareHandler = async (c, next) => {
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD' && !/^application\/json(;|$)/.test(c.req.header('Content-Type') ?? '')) {
    return c.text('Unsupported Media Type', 415)
  }
  await next()
}

// 连接建立时立刻发出：只写响应头不会真的发出去。retry 让浏览器断线后 1 秒就重连，上线时后端重启不会断开太久
const connectedPreamble = 'retry: 1000\n\n'

// 定时发 ping：Cloudflare 会断开长时间没有数据的连接，页面也靠它发现已经断掉却没有报错的连接
async function keepAlive(stream: SSEStreamingApi) {
  while (!stream.aborted) {
    await stream.sleep(15000)
    await stream.writeSSE({ event: 'ping', data: '' })
  }
}

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

// 文件名由后端生成，内容不会变，可以长期缓存
const fileTypes: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' }

function start(sessionId: number | undefined, text: string) {
  const id = startTurn(sessionId, text)
  return id === undefined ? ({ error: 'busy' } as const) : { id }
}

export const api = new Hono()
  .basePath('/api')
  // 上线脚本在本机检查它，拿不到 Access 凭证，所以注册在身份校验之前
  .get('/health', (c) => c.json({ version }))
  .use(requireOwner, requireJson)
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
  // 条目的事件 id 是到它为止的条数，浏览器断线重连时带上 Last-Event-ID，从那之后接着补发
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
      await stream.write(connectedPreamble)
      readTranscript(id).forEach((entry, index) => {
        if (index >= from) {
          send({ type: 'entry', index, entry })
        }
      })
      liveState(id).forEach(send)
      stream.onAbort(subscribe(id, send))
      await keepAlive(stream)
    })
  })
  // 页面只连这一条全局通知，收到后重新读取对应的数据；断线重连后页面会全部重新读取，这里不补发
  .get('/events', (c) =>
    streamSSE(c, async (stream) => {
      await stream.write(connectedPreamble)
      const send = (event: ChangeEvent) => void stream.writeSSE({ data: JSON.stringify(event) })
      stream.onAbort(onSessionChanged((id) => send({ type: 'session', id })))
      await keepAlive(stream)
    }),
  )

export type AppType = typeof api

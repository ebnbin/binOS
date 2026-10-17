import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'
import { streamSSE } from 'hono/streaming'
import type { SSEStreamingApi } from 'hono/streaming'
import { validator } from 'hono/validator'
import { requireOwner } from './access.js'
import { onChange, subscribe } from './events.js'
import { codeDir } from './paths.js'
import { filesDir, listSessions, readTranscript, sessionExists, sessionSummary } from './sessions.js'
import { applyChanges, parseChanges, readState } from './state.js'
import { isAnswering, liveState, startTurn, stopTurn } from './turns.js'
import type { Attachment, ChangeEvent, LiveEvent, SessionSummary } from './types.js'
import { parseAttachments, saveUpload, UploadTooLarge } from './uploads.js'

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

// attachments 的 file 是上传后拿到的文件名；有附件时可以不写字
const messageBody = validator('json', (value, c) => {
  const body = value as { text?: unknown; attachments?: unknown } | null
  const attachments = parseAttachments(body?.attachments)
  if (typeof body?.text !== 'string' || !attachments || (!body.text.trim() && !attachments.length)) {
    return c.text('Bad Request', 400)
  }
  return { text: body.text, attachments }
})

const stateBody = validator('json', (value, c) => {
  const changes = parseChanges((value as { changes?: unknown } | null)?.changes)
  if (!changes) {
    return c.text('Bad Request', 400)
  }
  return { changes }
})

// 附件可能是任何文件，只有这些在页面里直接打开，其余一律下载：HTML、SVG 之类在这个域名下打开的话，里面的脚本就能以你的身份操作
const inlineTypes: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
  txt: 'text/plain; charset=utf-8',
  md: 'text/plain; charset=utf-8',
  log: 'text/plain; charset=utf-8',
  csv: 'text/plain; charset=utf-8',
  json: 'text/plain; charset=utf-8',
}

function start(sessionId: number | undefined, text: string, attachments: Attachment[]) {
  const id = startTurn(sessionId, text, attachments)
  return id === undefined ? ({ error: 'busy' } as const) : { id }
}

export const api = new Hono()
  .basePath('/api')
  // 上线脚本在本机检查它，拿不到 Access 凭证，所以注册在身份校验之前
  .get('/health', (c) => c.json({ version }))
  .use(requireOwner, requirePreflight)
  .get('/state', (c) => c.json(readState()))
  .post('/state', stateBody, (c) => c.json({ version: applyChanges(c.req.valid('json').changes) }, 200))
  .get('/sessions', (c) => {
    const sessions: SessionSummary[] = listSessions().map((id) => ({ ...sessionSummary(id), running: isAnswering(id) }))
    return c.json({ sessions })
  })
  // 请求体就是文件本身，原来的文件名 URL 编码后放在 X-File-Name 里
  .post('/uploads', async (c) => {
    const body = c.req.raw.body
    if (!body || c.req.header('Content-Type') !== 'application/octet-stream') {
      return c.text('Bad Request', 400)
    }
    let name = ''
    try {
      name = decodeURIComponent(c.req.header('X-File-Name') ?? '')
    } catch {
      // 文件名解不开就当没有
    }
    try {
      return c.json({ file: await saveUpload(body, name) }, 200)
    } catch (error) {
      if (error instanceof UploadTooLarge) {
        return c.text('Payload Too Large', 413)
      }
      throw error
    }
  })
  .post('/sessions', messageBody, (c) => {
    const { text, attachments } = c.req.valid('json')
    const result = start(undefined, text, attachments)
    return 'id' in result ? c.json(result, 200) : c.json(result, 409)
  })
  .post('/sessions/:id/messages', sessionParam, messageBody, (c) => {
    const { text, attachments } = c.req.valid('json')
    const result = start(c.req.valid('param').id, text, attachments)
    return 'id' in result ? c.json(result, 200) : c.json(result, 409)
  })
  .post('/sessions/:id/stop', sessionParam, (c) => {
    if (!stopTurn(c.req.valid('param').id)) {
      return c.text('Not Found', 404)
    }
    return c.json({ ok: true }, 200)
  })
  // 文件名由后端生成，内容不会变，可以长期缓存。name 是下载时用的文件名
  .get('/sessions/:id/files/:file', sessionParam, (c) => {
    const file = c.req.param('file')
    const match = /^[\w-]+(?:\.(\w+))?$/.exec(file)
    const filePath = path.join(filesDir(c.req.valid('param').id), file)
    if (!match || !existsSync(filePath)) {
      return c.text('Not Found', 404)
    }
    const inline = match[1] && inlineTypes[match[1].toLowerCase()]
    const name = c.req.query('name')
    const disposition = (inline ? 'inline' : 'attachment') + (name ? `; filename*=UTF-8''${encodeURIComponent(name)}` : '')
    return c.body(readFileSync(filePath), 200, {
      'Content-Type': inline || 'application/octet-stream',
      'Content-Disposition': disposition,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=31536000, immutable',
    })
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

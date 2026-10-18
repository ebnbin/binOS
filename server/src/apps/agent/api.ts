import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { validator } from 'hono/validator'
import { connectedPreamble, keepAlive } from '../../sse.js'
import { subscribe } from './live-events.js'
import { filesDir, listSessions, readTranscript, sessionExists, sessionInfo } from './sessions.js'
import { isAnswering, liveState, startTurn, stopTurn } from './turns.js'
import type { Attachment, LiveEvent, SessionSummary } from './types.js'
import { parseAttachments, saveUpload, UploadTooLarge } from './uploads.js'

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

export const agentApi = new Hono()
  .get('/sessions', (c) => {
    const sessions: SessionSummary[] = listSessions().map((id) => {
      const { title, updatedAt } = sessionInfo(id)
      return { id, title, updatedAt, running: isAnswering(id) }
    })
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
  // 记录的事件 id 是到它为止的条数，浏览器断线重连时带上 Last-Event-ID，从那之后接着补发
  .get('/sessions/:id/stream', sessionParam, (c) => {
    const id = c.req.valid('param').id
    const from = Number(c.req.header('Last-Event-ID') ?? c.req.query('from') ?? 0) || 0
    return streamSSE(c, async (stream) => {
      const send = (event: LiveEvent) =>
        void stream.writeSSE({
          data: JSON.stringify(event),
          id: event.type === 'record' ? String(event.index + 1) : undefined,
        })
      // 读取记录、补发、开始监听之间没有等待，不会漏掉或重复条目
      await stream.write(connectedPreamble)
      readTranscript(id).forEach((record, index) => {
        if (index >= from) {
          send({ type: 'record', index, record })
        }
      })
      send({ type: 'live', live: liveState(id) })
      stream.onAbort(subscribe(id, send))
      await keepAlive(stream)
    })
  })

export type AgentApi = typeof agentApi

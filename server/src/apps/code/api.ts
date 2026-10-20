import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { validator } from 'hono/validator'
import { notifyChange } from '../../events.js'
import { providers } from '../../services/agent/types.js'
import type { Provider } from '../../services/agent/types.js'
import { connectedPreamble, keepAlive } from '../../sse.js'
import { subscribe } from './live-events.js'
import { filesDir, listSessions, readTranscript, searchSessions, sessionExists, sessionInfo, setUserState } from './sessions.js'
import { readQueue } from './queue.js'
import { isAnswering, isWaiting, liveState, queueMessage, renameSession, sendMessage, sendQueued, stopTurn, unqueueMessage } from './turns.js'
import type { MessageOptions } from './turns.js'
import { pullRequests } from './pull-requests.js'
import type { Attachment, LiveEvent, SessionSummary } from './types.js'
import { parseAttachments, saveUpload, UploadTooLarge } from './uploads.js'

const sessionParam = validator('param', (value: Record<string, string>, c) => {
  const id = Number(value.id)
  if (!sessionExists(id)) {
    return c.text('Not Found', 404)
  }
  return { id }
})

// 排队的一条消息
const queueParam = validator('param', (value: Record<string, string>, c) => {
  const id = Number(value.id)
  if (!sessionExists(id)) {
    return c.text('Not Found', 404)
  }
  return { id, item: value.item ?? '' }
})

const isProvider = (value: unknown): value is Provider => providers.includes(value as Provider)
// 模型和思考程度是否适用于这个 agent，开始一轮时再看
const isName = (value: unknown): value is string => typeof value === 'string' && /^[\w.-]{1,64}$/.test(value)

// attachments 的 file 是上传后拿到的文件名；有附件时可以不写字。
// interrupt：正在回答时先打断正在做的事；queue：正在回答时排到这一轮答完之后；provider：新的 session 用哪个 agent，不给是默认的；
// model、effort：开始新的一轮时用，不给就是 agent 的默认
const messageBody = validator('json', (value, c) => {
  const body = value as { text?: unknown; attachments?: unknown; interrupt?: unknown; queue?: unknown; provider?: unknown; model?: unknown; effort?: unknown } | null
  const attachments = parseAttachments(body?.attachments)
  if (
    typeof body?.text !== 'string' ||
    !attachments ||
    (!body.text.trim() && !attachments.length) ||
    (body.provider !== undefined && !isProvider(body.provider)) ||
    (body.model !== undefined && !isName(body.model)) ||
    (body.effort !== undefined && !isName(body.effort))
  ) {
    return c.text('Bad Request', 400)
  }
  const message: { text: string; attachments: Attachment[]; queue?: true } & MessageOptions = {
    text: body.text,
    attachments,
    ...(body.queue === true && { queue: true as const }),
    interrupt: body.interrupt === true,
    ...(isProvider(body.provider) && { provider: body.provider }),
    ...(isName(body.model) && { model: body.model }),
    ...(isName(body.effort) && { effort: body.effort }),
  }
  return message
})

// 改名、置顶、归档，没给的项不动
const editBody = validator('json', (value, c) => {
  const body = value as { title?: unknown; pinned?: unknown; archived?: unknown } | null
  const title = typeof body?.title === 'string' ? body.title.replace(/\p{Cc}/gu, ' ').trim().slice(0, 200) : undefined
  if (
    !body ||
    (body.title !== undefined && !title) ||
    (body.pinned !== undefined && typeof body.pinned !== 'boolean') ||
    (body.archived !== undefined && typeof body.archived !== 'boolean')
  ) {
    return c.text('Bad Request', 400)
  }
  const edit: { title?: string; pinned?: boolean; archived?: boolean } = {
    ...(title && { title }),
    ...(typeof body.pinned === 'boolean' && { pinned: body.pinned }),
    ...(typeof body.archived === 'boolean' && { archived: body.archived }),
  }
  return edit
})

// PR 的状态查到有变化时，通知页面重新读取列表
async function summary(id: number): Promise<SessionSummary> {
  const info = sessionInfo(id)
  const prs = await pullRequests(info.prs, () => notifyChange({ type: 'session', id }))
  const waiting = isWaiting(id)
  const running = isAnswering(id) && !waiting
  return {
    id,
    title: info.title,
    updatedAt: info.updatedAt,
    running,
    waiting,
    unread: isUnread(id),
    ...(info.outcome && { outcome: info.outcome }),
    pinned: Boolean(info.pinned),
    archived: Boolean(info.archived),
    ...(info.context && { context: info.context }),
    provider: info.provider,
    ...(info.model && { model: info.model }),
    ...(info.effort && { effort: info.effort }),
    turns: info.turns,
    prs,
    queue: readQueue(id),
  }
}

// 页面正在看、又没在回答时才算看过
function isUnread(id: number) {
  const info = sessionInfo(id)
  return !isAnswering(id) && Boolean(info.readAt && info.repliedAt && info.repliedAt > info.readAt)
}

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

const toResult = (id: number | undefined) => (id === undefined ? ({ error: 'unavailable' } as const) : { id })

async function send(sessionId: number | undefined, text: string, attachments: Attachment[], options: MessageOptions) {
  return toResult(await sendMessage(sessionId, text, attachments, options))
}

export const codeApi = new Hono()
  // q：只要标题、用户的话或回复的文字里含有它的。按最近有动静的排在前面
  .get('/sessions', async (c) => {
    const query = c.req.query('q')?.trim()
    const ids = listSessions()
    const matched = query ? searchSessions(ids, query) : undefined
    const sessions = (await Promise.all(ids.filter((id) => !matched || matched.has(id)).map(summary))).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    )
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
  .post('/sessions', messageBody, async (c) => {
    const { text, attachments, queue: _queue, ...options } = c.req.valid('json')
    const result = await send(undefined, text, attachments, { ...options, interrupt: false })
    return 'id' in result ? c.json(result, 200) : c.json(result, 503)
  })
  // 正在回答时交给 agent 或者排队，没在回答时开始新的一轮
  .post('/sessions/:id/messages', sessionParam, messageBody, async (c) => {
    const { text, attachments, queue, ...options } = c.req.valid('json')
    const id = c.req.valid('param').id
    const result = queue ? toResult(await queueMessage(id, text, attachments, options)) : await send(id, text, attachments, options)
    return 'id' in result ? c.json(result, 200) : c.json(result, 503)
  })
  // 撤回排队的消息，返回它的文字放回输入框；已经发出去了时 404
  .post('/sessions/:id/queue/:item/withdraw', queueParam, (c) => {
    const { id, item } = c.req.valid('param')
    const text = unqueueMessage(id, item)
    return text === undefined ? c.json({ error: 'gone' } as const, 404) : c.json({ text }, 200)
  })
  // 现在就发一条排队的消息：只在没在回答时（被停止或出错后）
  .post('/sessions/:id/queue/:item/send', queueParam, async (c) => {
    const { id, item } = c.req.valid('param')
    if (isAnswering(id)) {
      return c.json({ error: 'answering' } as const, 409)
    }
    const result = toResult(await sendQueued(id, item))
    return 'id' in result ? c.json(result, 200) : c.json(result, 503)
  })
  // 改名记进 transcript；置顶、归档是用户的整理，记在 session.json
  .post('/sessions/:id/edit', sessionParam, editBody, (c) => {
    const id = c.req.valid('param').id
    const { title, pinned, archived } = c.req.valid('json')
    if (title && title !== sessionInfo(id).title) {
      renameSession(id, title)
    }
    if (pinned !== undefined) {
      setUserState(id, { pinned: pinned || undefined })
    }
    if (archived !== undefined) {
      setUserState(id, { archived: archived || undefined })
    }
    notifyChange({ type: 'session', id })
    return c.json({ ok: true }, 200)
  })
  // 页面正在显示这个 session：记为已读。原本有未读时才通知各个页面，否则页面收到通知重新读取，又会来标记，来回不停
  .post('/sessions/:id/read', sessionParam, (c) => {
    const id = c.req.valid('param').id
    const wasUnread = isUnread(id)
    setUserState(id, { readAt: new Date().toISOString() })
    if (wasUnread) {
      notifyChange({ type: 'session', id })
    }
    return c.json({ ok: true }, 200)
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

export type CodeApi = typeof codeApi

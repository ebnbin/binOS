import { existsSync, statSync, createReadStream } from 'node:fs'
import { Readable } from 'node:stream'
import path from 'node:path'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { validator } from 'hono/validator'
import { connectedPreamble, keepAlive } from '../../sse.js'
import { agentAccounts, agentCatalogs } from './accounts.js'
import { drivers } from './drivers/index.js'
import { allLimits } from './limits.js'
import { filesDir } from './store.js'
import { getThread } from './threads.js'
import { agentIds } from './types.js'
import type { AgentStatus, ThreadEvent } from './types.js'


const threadParam = validator('param', (value: Record<string, string>, c) => {
  const id = value.id ?? ''
  return getThread(id) ? { id } : c.text('Not Found', 404)
})

// thread 的文件可能是任何文件，只有这些在页面里直接打开，其余一律下载：HTML、SVG 之类在这个域名下打开的话，里面的脚本就能以你的身份操作
const inlineTypes: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  avif: 'image/avif',
  bmp: 'image/bmp',
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



// 页面用到的 agent 服务：系统 app 显示账号，app 里选 agent 和模型、显示 thread 的内容。
// 建 thread、说话由各个 app 在后端调用；各个 agent 自己的接口（比如在网页上登录）在 /<agent 的 id> 下
export const agentApi = new Hono()
  // 各个 agent 最近报告的额度和登录的状况，页面收到 agent 通知时重新读取
  .get('/status', (c) =>
    c.json({ limits: allLimits(), auth: Object.fromEntries(agentIds.map((agent) => [agent, drivers[agent].auth()])) as AgentStatus['auth'] } satisfies AgentStatus),
  )
  // 各个 agent 的账号、登录凭证和用量
  .get('/accounts', async (c) => c.json({ accounts: await agentAccounts() }))
  // 各个 agent 能不能用、有哪些模型
  .get('/agents', async (c) => c.json({ agents: await agentCatalogs() }))
  // 条目的事件 id 是到它为止的条数，浏览器断线重连时带上 Last-Event-ID，从那之后接着补发
  .get('/threads/:id/stream', threadParam, (c) => {
    const thread = getThread(c.req.valid('param').id)!
    const from = Number(c.req.header('Last-Event-ID') ?? c.req.query('from') ?? 0) || 0
    return streamSSE(c, async (stream) => {
      const send = (event: ThreadEvent) =>
        void stream.writeSSE({ data: JSON.stringify(event), id: event.type === 'item' ? String(event.index + 1) : undefined })
      // 读取条目、补发、开始监听之间没有等待，不会漏掉或重复
      await stream.write(connectedPreamble)
      thread.items(from).forEach((item, offset) => send({ type: 'item', index: from + offset, item }))
      send({ type: 'live', live: thread.live() })
      stream.onAbort(thread.subscribe(send))
      await keepAlive(stream)
    })
  })
  // 文件名由后端生成，内容不会变，可以长期缓存。name 是下载时用的文件名
  .get('/threads/:id/files/:file', threadParam, (c) => {
    const file = c.req.param('file')
    const match = /^[\w-]+(?:\.(\w+))?$/.exec(file)
    const filePath = path.join(filesDir(c.req.valid('param').id), file)
    if (!match || !existsSync(filePath)) {
      return c.text('Not Found', 404)
    }
    const inline = match[1] && inlineTypes[match[1].toLowerCase()]
    const name = c.req.query('name')
    const disposition = (inline && !name ? 'inline' : 'attachment') + (name ? `; filename*=UTF-8''${encodeURIComponent(name)}` : '')
    const info = statSync(filePath)
    if (!info.isFile()) return c.text('Not Found', 404)
    if (c.req.query('info') === '1') {
      return c.json({ size: info.size, modified: info.mtime.toISOString(), type: inline || 'application/octet-stream' })
    }
    const headers = {
      'Content-Type': inline || 'application/octet-stream',
      'Content-Disposition': disposition,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=31536000, immutable',
      'Accept-Ranges': 'bytes',
    }
    const range = c.req.header('Range')
    let start = 0
    let end = info.size - 1
    if (range) {
      const parsed = /^bytes=(\d*)-(\d*)$/.exec(range)
      if (!parsed || (!parsed[1] && !parsed[2])) {
        return c.body(null, 416, { 'Content-Range': `bytes */${info.size}` })
      }
      start = parsed[1] ? Number(parsed[1]) : Math.max(0, info.size - Number(parsed[2]))
      end = parsed[1] && parsed[2] ? Math.min(Number(parsed[2]), end) : end
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= info.size) {
        return c.body(null, 416, { 'Content-Range': `bytes */${info.size}` })
      }
    }
    if (info.size === 0) {
      return c.body(null, 200, { ...headers, 'Content-Length': '0' })
    }
    const body = Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream<Uint8Array>
    return c.body(body, range ? 206 : 200, {
      ...headers,
      'Content-Length': String(end - start + 1),
      ...(range ? { 'Content-Range': `bytes ${start}-${end}/${info.size}` } : {}),
    })
  })

// 各个 agent 的接口，页面用 driver 各自导出的类型
for (const driver of Object.values(drivers)) {
  agentApi.route(`/${driver.id}`, driver.api)
}

export type AgentApi = typeof agentApi

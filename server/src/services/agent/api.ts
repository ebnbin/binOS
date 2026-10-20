import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { validator } from 'hono/validator'
import { connectedPreamble, keepAlive } from '../../sse.js'
import { agentAccounts, agentCatalogs } from './accounts.js'
import { claudeAuth } from './drivers/claude/auth.js'
import { cancelClaudeLogin, finishClaudeLogin, startClaudeLogin } from './drivers/claude/login.js'
import type { ClaudeLoginKind } from './drivers/claude/login.js'
import { codexAuth } from './drivers/codex/auth.js'
import { cancelCodexLogin, codexLoginStatus, startCodexLogin } from './drivers/codex/login.js'
import { allLimits } from './limits.js'
import { filesDir } from './store.js'
import { getThread } from './threads.js'
import type { AgentStatus, ThreadEvent } from './types.js'

const loginBody = validator('json', (value, c) => {
  const kind = (value as { kind?: unknown } | null)?.kind
  return kind === 'login' || kind === 'token' ? { kind: kind as ClaudeLoginKind } : c.text('Bad Request', 400)
})

const threadParam = validator('param', (value: Record<string, string>, c) => {
  const id = value.id ?? ''
  return getThread(id) ? { id } : c.text('Not Found', 404)
})

// thread 的文件可能是任何文件，只有这些在页面里直接打开，其余一律下载：HTML、SVG 之类在这个域名下打开的话，里面的脚本就能以你的身份操作
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

const codeBody = validator('json', (value, c) => {
  const code = (value as { code?: unknown } | null)?.code
  return typeof code === 'string' && /^[\w#.~-]{1,500}$/.test(code.trim()) ? { code } : c.text('Bad Request', 400)
})

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))

// 页面用到的 agent 服务：系统 app 显示账号、登录 Claude 和 Codex，app 里选 agent 和模型、显示 thread 的内容。
// 建 thread、说话由各个 app 在后端调用
export const agentApi = new Hono()
  // 各个 agent 最近报告的额度和登录的状况，页面收到 agent 通知时重新读取
  .get('/status', (c) => c.json({ limits: allLimits(), claude: claudeAuth(), codex: codexAuth() } satisfies AgentStatus))
  // 各个 agent 的账号、登录凭证和用量
  .get('/accounts', async (c) => c.json({ accounts: await agentAccounts() }))
  // 各个 agent 能不能用、有哪些模型
  .get('/agents', async (c) => c.json({ agents: await agentCatalogs() }))
  // 开始在网页上登录 Claude（见 claude/login.ts），返回授权链接
  .post('/claude/login', loginBody, async (c) => {
    try {
      return c.json(await startClaudeLogin(c.req.valid('json').kind), 200)
    } catch (error) {
      return c.json({ error: errorText(error) }, 500)
    }
  })
  // 贴回授权后的代码，完成登录
  .post('/claude/login/:id', codeBody, async (c) => {
    try {
      await finishClaudeLogin(c.req.param('id'), c.req.valid('json').code)
      return c.json({ ok: true as const }, 200)
    } catch (error) {
      return c.json({ error: errorText(error) }, 500)
    }
  })
  .post('/claude/login/:id/cancel', (c) => {
    cancelClaudeLogin(c.req.param('id'))
    return c.json({ ok: true as const }, 200)
  })
  // 开始在网页上重新登录 Codex（见 codex/login.ts），返回网址和一次性的码
  .post('/codex/login', async (c) => {
    try {
      return c.json(await startCodexLogin(), 200)
    } catch (error) {
      return c.json({ error: errorText(error) }, 500)
    }
  })
  // 页面轮询：用户授权了没有
  .get('/codex/login/:id', (c) => c.json(codexLoginStatus(c.req.param('id'))))
  .post('/codex/login/:id/cancel', (c) => {
    cancelCodexLogin(c.req.param('id'))
    return c.json({ ok: true as const }, 200)
  })

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
    const disposition = (inline ? 'inline' : 'attachment') + (name ? `; filename*=UTF-8''${encodeURIComponent(name)}` : '')
    return c.body(readFileSync(filePath), 200, {
      'Content-Type': inline || 'application/octet-stream',
      'Content-Disposition': disposition,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=31536000, immutable',
    })
  })

export type AgentApi = typeof agentApi

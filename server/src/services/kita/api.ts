import { existsSync } from 'node:fs'
import { serveFile } from '../../files.js'
import path from 'node:path'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { validator } from 'hono/validator'
import { connectedPreamble, keepAlive } from '../../sse.js'
import { agentAccounts, agentCatalogs } from './accounts.js'
import { drivers } from './drivers/index.js'
import { allLimits } from './limits.js'
import { filesDir } from './store.js'
import { getKitaSession } from './sessions.js'
import { agentIds } from './types.js'
import type { AgentStatus, KitaSessionEvent } from './types.js'

const threadParam = validator('param', (value: Record<string, string>, c) => {
  const id = value.id ?? ''
  return getKitaSession(id) ? { id } : c.text('Not Found', 404)
})

// 页面用到的 agent 服务：系统 app 显示账号，app 里选 agent 和模型、显示 session 的内容。
// 建 session、说话由各个 app 在后端调用；各个 agent 自己的接口（比如在网页上登录）在 /<agent 的 id> 下
export const kitaApi = new Hono()
  // 各个 agent 最近报告的额度和登录的状况，页面收到 agent 通知时重新读取
  .get('/status', (c) =>
    c.json({ limits: allLimits(), auth: Object.fromEntries(agentIds.map((agent) => [agent, drivers[agent].auth()])) as AgentStatus['auth'] } satisfies AgentStatus),
  )
  // 各个 agent 的账号、登录凭证和用量
  .get('/accounts', async (c) => c.json({ accounts: await agentAccounts() }))
  // 各个 agent 能不能用、有哪些模型
  .get('/agents', async (c) => c.json({ agents: await agentCatalogs() }))
  .get('/sessions/:id', threadParam, (c) => {
    const session = getKitaSession(c.req.valid('param').id)!
    return c.json({ metadata: session.metadata(), summary: session.summary(), turns: session.turns(), items: session.items() })
  })
  .get('/sessions/:id/events', threadParam, (c) => {
    const from = Number(c.req.query('from') ?? 0)
    if (!Number.isSafeInteger(from) || from < 0) return c.text('Bad Request', 400)
    return c.json({ events: getKitaSession(c.req.valid('param').id)!.events(from) })
  })
  // 条目的事件 id 是到它为止的条数，浏览器断线重连时带上 Last-Event-ID，从那之后接着补发
  .get('/sessions/:id/stream', threadParam, (c) => {
    const session = getKitaSession(c.req.valid('param').id)!
    const from = Number(c.req.header('Last-Event-ID') ?? c.req.query('from') ?? 0) || 0
    return streamSSE(c, async (stream) => {
      const send = (event: KitaSessionEvent) =>
        void stream.writeSSE({ data: JSON.stringify(event), id: event.type === 'event' ? String(event.event.seq) : undefined })
      // 读取条目、补发、开始监听之间没有等待，不会漏掉或重复
      await stream.write(connectedPreamble)
      session.events(from).forEach((event) => send({ type: 'event', event }))
      send({ type: 'live', live: session.live() })
      stream.onAbort(session.subscribe(send))
      await keepAlive(stream)
    })
  })
  // 文件名由后端生成，内容不会变，可以长期缓存。name 是下载时用的文件名
  .get('/sessions/:id/files/:file', threadParam, (c) => {
    const file = c.req.param('file')
    const match = /^[\w-]+(?:\.(\w+))?$/.exec(file)
    const filePath = path.join(filesDir(c.req.valid('param').id), file)
    if (!match || !existsSync(filePath)) {
      return c.text('Not Found', 404)
    }
    return serveFile(c, filePath, true)
  })

// 各个 agent 的接口，页面用 driver 各自导出的类型
for (const driver of Object.values(drivers)) {
  kitaApi.route(`/${driver.id}`, driver.api)
}

export type KitaApi = typeof kitaApi

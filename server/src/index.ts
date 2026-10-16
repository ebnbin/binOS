import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import type { Context } from 'hono'
import { streamSSE } from 'hono/streaming'
import { requireOwner } from './access.js'
import { liveState, recoverInterruptedTurns, startTurn, subscribe } from './agent.js'
import { listSessions, readTranscript, sessionExists } from './sessions.js'

recoverInterruptedTurns()

const app = new Hono()

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

app.get('/api/sessions', (c) => c.json({ ids: listSessions() }))

app.post('/api/sessions', async (c) => start(c, undefined, await readText(c)))

app.post('/api/sessions/:id/messages', async (c) => {
  const id = Number(c.req.param('id'))
  if (!sessionExists(id)) {
    return c.text('Not Found', 404)
  }
  return start(c, id, await readText(c))
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

serve({
  fetch: app.fetch,
  hostname: '127.0.0.1',
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})

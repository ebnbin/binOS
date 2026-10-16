import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { requireOwner } from './access.js'
import { getTask, startTask } from './agent.js'

const app = new Hono()

app.use('/api/*', requireOwner)

app.post('/api/agent/tasks', async (c) => {
  // 只接受 JSON：浏览器跨站提交 JSON 需要预检，其他网站无法借你的登录状态发起请求
  if (c.req.header('Content-Type') !== 'application/json') {
    return c.text('Unsupported Media Type', 415)
  }
  const { message } = await c.req.json()
  if (typeof message !== 'string' || !message.trim()) {
    return c.text('Bad Request', 400)
  }
  const id = startTask(message)
  if (!id) {
    return c.json({ error: 'busy' }, 409)
  }
  return c.json({ id })
})

app.get('/api/agent/tasks/:id', (c) => {
  const task = getTask(c.req.param('id'))
  if (!task) {
    return c.text('Not Found', 404)
  }
  return c.json(task)
})

serve({
  fetch: app.fetch,
  hostname: '127.0.0.1',
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})

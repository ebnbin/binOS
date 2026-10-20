import { open } from 'node:fs/promises'
import path from 'node:path'
import { Hono } from 'hono'
import { rootFromEnv, rootLayout } from '../../layout.js'
import { monitor } from './monitor.js'

const logs = rootLayout(rootFromEnv()).logsDir
export const systemApi = new Hono()
  .use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store')
    await next()
  })
  .onError((error, c) => c.json({ error: error.message }, 400))
  .get('/status', (c) => c.json(monitor.status()))
  .get('/history', (c) => c.json({ samples: monitor.history() }))
  .post('/refresh', async (c) => {
    await monitor.refresh()
    return c.json(monitor.status())
  })
  .put('/thresholds', async (c) => c.json({ thresholds: monitor.configure(await c.req.json()) }))
  .post('/alerts/:id/acknowledge', (c) => {
    monitor.acknowledge(c.req.param('id'))
    return c.json({ ok: true })
  })
  .post('/awake', async (c) => {
    const body = await c.req.json()
    await monitor.keepAwake(body.hours)
    return c.json({ until: monitor.status().keepAwakeUntil })
  })
  .get('/logs/:name', async (c) => {
    const name = c.req.param('name')
    if (!['server', 'tunnel', 'deploy'].includes(name)) return c.json({ error: '未知日志' }, 404)
    const file = await open(path.join(logs, name + '.log'), 'r')
    try {
      const info = await file.stat()
      const start = Math.max(0, info.size - 64 * 1024)
      const buffer = Buffer.alloc(info.size - start)
      const { bytesRead } = await file.read(buffer, 0, buffer.length, start)
      const text = buffer.subarray(0, bytesRead).toString('utf8')
      return c.json({ name, bytes: info.size, modified: info.mtimeMs, truncated: start > 0, text: start ? text.slice(text.indexOf('\n') + 1) : text })
    } finally {
      await file.close()
    }
  })
  .get('/report', (c) => {
    c.header('Content-Disposition', `attachment; filename="binos-diagnostics-${Date.now()}.json"`)
    return c.json({ generatedAt: new Date().toISOString(), ...monitor.status(), samples: monitor.history() })
  })

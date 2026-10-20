import { Hono } from 'hono'
import { monitor } from './monitor.js'

export const systemApi = new Hono()
  .use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store')
    await next()
  })
  .get('/status', (c) => c.json(monitor.status()))
  .post('/refresh', async (c) => {
    await monitor.refresh()
    return c.json(monitor.status())
  })

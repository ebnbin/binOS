import { serve } from '@hono/node-server'
import { Hono } from 'hono'

const app = new Hono()

app.get('/api/hello', (c) => {
  return c.text('Hello Hono!')
})

serve({
  fetch: app.fetch,
  hostname: '127.0.0.1',
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})

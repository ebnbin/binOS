import { Hono } from 'hono'
import { cancelCodexLogin, codexLoginStatus, startCodexLogin } from './login.js'

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))

// 在网页上重新登录 Codex（设备码登录，见 login.ts）：/api/agent/codex 下
export const codexApi = new Hono()
  // 开始登录，返回网址和一次性的码
  .post('/login', async (c) => {
    try {
      return c.json(await startCodexLogin(), 200)
    } catch (error) {
      return c.json({ error: errorText(error) }, 500)
    }
  })
  // 页面轮询：用户授权了没有
  .get('/login/:id', (c) => c.json(codexLoginStatus(c.req.param('id'))))
  .post('/login/:id/cancel', (c) => {
    cancelCodexLogin(c.req.param('id'))
    return c.json({ ok: true as const }, 200)
  })

export type CodexApi = typeof codexApi

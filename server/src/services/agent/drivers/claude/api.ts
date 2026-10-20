import { Hono } from 'hono'
import { validator } from 'hono/validator'
import { cancelClaudeLogin, finishClaudeLogin, startClaudeLogin } from './login.js'
import type { ClaudeLoginKind } from './login.js'

const loginBody = validator('json', (value, c) => {
  const kind = (value as { kind?: unknown } | null)?.kind
  return kind === 'login' || kind === 'token' ? { kind: kind as ClaudeLoginKind } : c.text('Bad Request', 400)
})

const codeBody = validator('json', (value, c) => {
  const code = (value as { code?: unknown } | null)?.code
  return typeof code === 'string' && /^[\w#.~-]{1,500}$/.test(code.trim()) ? { code } : c.text('Bad Request', 400)
})

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))

// 在网页上登录 Claude（见 login.ts）：/api/agent/claude 下
export const claudeApi = new Hono()
  // 开始登录，返回授权链接
  .post('/login', loginBody, async (c) => {
    try {
      return c.json(await startClaudeLogin(c.req.valid('json').kind), 200)
    } catch (error) {
      return c.json({ error: errorText(error) }, 500)
    }
  })
  // 贴回授权后的代码，完成登录
  .post('/login/:id', codeBody, async (c) => {
    try {
      await finishClaudeLogin(c.req.param('id'), c.req.valid('json').code)
      return c.json({ ok: true as const }, 200)
    } catch (error) {
      return c.json({ error: errorText(error) }, 500)
    }
  })
  .post('/login/:id/cancel', (c) => {
    cancelClaudeLogin(c.req.param('id'))
    return c.json({ ok: true as const }, 200)
  })

export type ClaudeApi = typeof claudeApi

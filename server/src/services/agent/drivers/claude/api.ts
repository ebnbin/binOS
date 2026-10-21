import { accountSelection, selectAccount } from './accounts.js'
import { Hono } from 'hono'
import { validator } from 'hono/validator'
import { cancelClaudeLogin, finishClaudeLogin, startClaudeLogin } from './login.js'
import type { ClaudeLoginKind } from './login.js'

const loginBody = validator('json', (value, c) => {
  const kind = (value as { kind?: unknown } | null)?.kind
  const account = (value as { account?: unknown } | null)?.account
  return (kind === 'login' || kind === 'token') && (account === undefined || typeof account === 'string') ? { kind: kind as ClaudeLoginKind, account } : c.text('Bad Request', 400)
})

const codeBody = validator('json', (value, c) => {
  const code = (value as { code?: unknown } | null)?.code
  return typeof code === 'string' && /^[\w#.~-]{1,500}$/.test(code.trim()) ? { code } : c.text('Bad Request', 400)
})

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))

// 在网页上登录 Claude（见 login.ts）：/api/agent/claude 下
export const claudeApi = new Hono()
  .get('/accounts', (c) => {
    const { active, accounts } = accountSelection()
    return c.json({ active, accounts })
  })
  .post('/accounts/select', validator('json', (value, c) => {
    const name = (value as { name?: unknown } | null)?.name
    return typeof name === 'string' ? { name } : c.text('Bad Request', 400)
  }), (c) => {
    try {
      selectAccount(c.req.valid('json').name)
      return c.json({ ok: true as const })
    } catch (error) {
      return c.json({ error: errorText(error) }, 400)
    }
  })
  // 开始登录，返回授权链接
  .post('/login', loginBody, async (c) => {
    try {
      return c.json(await startClaudeLogin(c.req.valid('json').kind, c.req.valid('json').account), 200)
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

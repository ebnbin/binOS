import { Hono } from 'hono'
import { validator } from 'hono/validator'
import { agentAccounts, agentCatalogs } from './accounts.js'
import { cancelLogin, finishLogin, startLogin } from './claude/login.js'
import type { LoginKind } from './claude/login.js'
import { cancelCodexLogin, codexLoginStatus, startCodexLogin } from './codex/login.js'

const loginBody = validator('json', (value, c) => {
  const kind = (value as { kind?: unknown } | null)?.kind
  return kind === 'login' || kind === 'token' ? { kind: kind as LoginKind } : c.text('Bad Request', 400)
})

const codeBody = validator('json', (value, c) => {
  const code = (value as { code?: unknown } | null)?.code
  return typeof code === 'string' && /^[\w#.~-]{1,500}$/.test(code.trim()) ? { code } : c.text('Bad Request', 400)
})

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))

// 页面用到的 agent 服务：系统 app 显示账号、登录 Claude 和 Codex，app 里选 agent 和模型
export const agentApi = new Hono()
  // 各个 agent 的账号、登录凭证和用量
  .get('/accounts', async (c) => c.json({ accounts: await agentAccounts() }))
  // 各个 agent 能不能用、有哪些模型
  .get('/agents', async (c) => c.json({ agents: await agentCatalogs() }))
  // 开始在网页上登录 Claude（见 claude/login.ts），返回授权链接
  .post('/claude/login', loginBody, async (c) => {
    try {
      return c.json(await startLogin(c.req.valid('json').kind), 200)
    } catch (error) {
      return c.json({ error: errorText(error) }, 500)
    }
  })
  // 贴回授权后的代码，完成登录
  .post('/claude/login/:id', codeBody, async (c) => {
    try {
      await finishLogin(c.req.param('id'), c.req.valid('json').code)
      return c.json({ ok: true as const }, 200)
    } catch (error) {
      return c.json({ error: errorText(error) }, 500)
    }
  })
  .post('/claude/login/:id/cancel', (c) => {
    cancelLogin(c.req.param('id'))
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

export type AgentApi = typeof agentApi

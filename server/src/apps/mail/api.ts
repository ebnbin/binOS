import { createHash, randomBytes } from 'node:crypto'
import { CodeChallengeMethod } from 'google-auth-library'
import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { validator } from 'hono/validator'
import { html } from 'hono/html'
import { notifyChange } from '../../events.js'
import { appDir } from '../../paths.js'
import { previewType, renderMessage } from './content.js'
import { MailError, oauthClient } from './gmail.js'
import { gmailId, MailService } from './service.js'
import { MailStore } from './store.js'

const callbackPath = '/api/apps/mail/oauth/callback'
const cookieName = 'binos-mail-oauth'
const configBody = validator('json', (value, c) => {
  const body = value as { clientId?: unknown; clientSecret?: unknown; redirectUri?: unknown } | null
  if (!body || typeof body.clientId !== 'string' || typeof body.clientSecret !== 'string' || typeof body.redirectUri !== 'string') return c.json({ error: '请填写 OAuth 客户端配置' }, 400)
  if (!body.clientId.endsWith('.apps.googleusercontent.com') || body.clientId.length > 300 || !body.clientSecret.trim() || body.clientSecret.length > 500) return c.json({ error: 'OAuth 客户端配置无效' }, 400)
  try {
    const url = new URL(body.redirectUri)
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) || url.pathname !== callbackPath || url.search || url.hash || url.username || url.password || (c.req.header('Origin') && url.origin !== c.req.header('Origin'))) throw new Error()
  } catch { return c.json({ error: '回调地址必须是当前 binOS 的 HTTPS 地址，或 localhost 测试地址' }, 400) }
  return { clientId: body.clientId.trim(), clientSecret: body.clientSecret.trim(), redirectUri: body.redirectUri }
})

export function createMailApi(service: MailService) {
  const store = service.store
  let pending: { state: string; verifier: string; browser: string; expires: number } | undefined
  return new Hono()
    .use(async (c, next) => { c.header('Cache-Control', 'no-store'); c.header('Referrer-Policy', 'no-referrer'); await next() })
    .onError((error, c) => {
      const message = error instanceof MailError ? error.message : '邮件操作失败，请稍后重试'
      const status = error instanceof MailError ? error.status as 400 | 401 | 403 | 404 | 409 | 429 | 502 : 502
      if (c.req.path.endsWith('/oauth/callback')) return c.html(html`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Mail · 连接账号</title><body style="font:16px/1.8 system-ui;max-width:520px;margin:15vh auto;padding:24px"><h1>Mail</h1><p>${message}</p><a href="/">返回 binOS，重新连接</a></body></html>`, status)
      return c.json({ error: message }, status)
    })
    .get('/account', (c) => c.json(service.status()))
    .put('/account', configBody, async (c) => service.run(async () => {
      if (store.account()?.tokens?.refresh_token) throw new MailError('请先断开当前账号再更改配置', 409)
      store.saveAccount(c.req.valid('json'))
      pending = undefined
      service.resetError()
      return c.json(service.status())
    }))
    .delete('/account', async (c) => service.run(async () => {
      const account = store.account()
      if (account) store.saveAccount({ clientId: account.clientId, clientSecret: account.clientSecret, redirectUri: account.redirectUri })
      pending = undefined
      store.clear()
      service.resetError()
      notifyChange({ type: 'mail' })
      return c.json({ ok: true })
    }))
    .post('/oauth/start', async (c) => service.run(async () => {
      const account = store.account()
      if (!account) throw new MailError('请先填写 Google OAuth 客户端配置', 400)
      if (c.req.header('Origin') !== new URL(account.redirectUri).origin) throw new MailError('请在配置的回调地址所在 binOS 页面连接账号', 400)
      const verifier = randomBytes(32).toString('base64url')
      pending = { state: randomBytes(32).toString('base64url'), browser: randomBytes(32).toString('base64url'), verifier, expires: Date.now() + 10 * 60_000 }
      setCookie(c, cookieName, pending.browser, { httpOnly: true, secure: account.redirectUri.startsWith('https:'), sameSite: 'Lax', path: callbackPath, maxAge: 600 })
      const url = oauthClient(account).generateAuthUrl({
        access_type: 'offline', prompt: 'consent', scope: ['https://www.googleapis.com/auth/gmail.modify'],
        state: pending.state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: CodeChallengeMethod.S256,
      })
      return c.json({ url })
    }))
    .get('/oauth/callback', async (c) => service.run(async () => {
      const attempt = pending
      if (!attempt || attempt.expires < Date.now() || attempt.state !== c.req.query('state') || attempt.browser !== getCookie(c, cookieName)) throw new MailError('授权请求已失效，请回到 Mail 重新连接', 400)
      pending = undefined
      deleteCookie(c, cookieName, { path: callbackPath })
      if (c.req.query('error')) throw new MailError('Google 授权未完成，请回到 Mail 重试', 400)
      const code = c.req.query('code')
      const account = store.account()
      if (!code || !account) throw new MailError('授权响应无效，请重新连接', 400)
      try {
        const client = oauthClient(account)
        const { tokens } = await client.getToken({ code, codeVerifier: attempt.verifier })
        if (!tokens.refresh_token) throw new Error()
        client.setCredentials(tokens)
        const profile = await client.request<{ emailAddress: string }>({ url: 'https://gmail.googleapis.com/gmail/v1/users/me/profile', timeout: 20_000 })
        if (!profile.data.emailAddress) throw new Error()
        if (account.email !== profile.data.emailAddress) store.clear()
        store.saveAccount({ ...account, tokens, email: profile.data.emailAddress })
        service.resetError()
      } catch { throw new MailError('连接 Gmail 失败，请确认 OAuth 配置、Gmail API 和授权权限后重试') }
      notifyChange({ type: 'mail' })
      // 不等待当前串行任务之后的同步，授权页面立即回到 binOS。
      void service.sync().catch(() => {})
      return c.redirect('/')
    }))
    .get('/threads', async (c) => service.run(async () => {
      const query = c.req.query('q') ?? 'in:inbox'
      const page = c.req.query('page') ?? ''
      if (query.length > 2000 || page.length > 2000) throw new MailError('搜索条件过长', 400)
      return c.json(await service.list(query, page))
    }))
    .get('/threads/:id', async (c) => service.run(async () => c.json(await service.thread(c.req.param('id')))))
    .post('/threads/:id/read', validator('json', (value, c) => {
      const read = (value as { read?: unknown } | null)?.read
      return typeof read === 'boolean' ? { read } : c.json({ error: '已读状态无效' }, 400)
    }), async (c) => service.run(async () => { await service.markRead(c.req.param('id'), c.req.valid('json').read); return c.json({ ok: true }) }))
    .get('/messages/:id/body', async (c) => service.run(async () => {
      const id = c.req.param('id')
      const message = await service.message(id)
      return c.json({ html: renderMessage(message, (part) => store.content(id, String(part))) })
    }))
    .get('/messages/:id/original', async (c) => service.run(async () => {
      const id = c.req.param('id')
      await service.message(id)
      c.header('Content-Type', 'message/rfc822')
      c.header('Content-Disposition', `attachment; filename="${id}.eml"`)
      c.header('X-Content-Type-Options', 'nosniff')
      return c.body(new Uint8Array(store.content(id, 'original.eml')))
    }))
    .get('/messages/:id/attachments/:part', async (c) => service.run(async () => {
      const id = c.req.param('id')
      const part = c.req.param('part')
      if (!gmailId(id) || !/^\d{1,5}$/.test(part)) throw new MailError('附件不存在', 404)
      const message = await service.message(id)
      const item = message.attachments.find((item) => String(item.id) === part)
      if (!item) throw new MailError('附件不存在', 404)
      c.header('Content-Type', previewType(item.type) ? item.type : 'application/octet-stream')
      c.header('Content-Disposition', `attachment; filename="attachment"; filename*=UTF-8''${encodeURIComponent(item.name).replaceAll("'", '%27')}`)
      c.header('X-Content-Type-Options', 'nosniff')
      c.header('Content-Security-Policy', "sandbox; default-src 'none'")
      return c.body(new Uint8Array(store.content(id, part)))
    }))
    .post('/sync', async (c) => { await service.sync(); return c.json(service.status()) })
}

export const mailService = new MailService(new MailStore(appDir('mail')), undefined, () => notifyChange({ type: 'mail' }))
export const mailApi = createMailApi(mailService)

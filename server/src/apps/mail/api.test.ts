import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MailService } from './service.js'
import { MailStore } from './store.js'
import type { GmailRequest } from './gmail.js'

vi.mock('../../paths.js', () => ({ appDir: () => '/tmp/binos-mail-unused' }))
const { createMailApi } = await import('./api.js')
const config = { clientId: 'fixture.apps.googleusercontent.com', clientSecret: 'fixture-secret', redirectUri: 'http://localhost/api/apps/mail/oauth/callback' }

describe('Mail API', () => {
  let store: MailStore
  let dir: string
  let app: ReturnType<typeof createMailApi>
  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'binos-mail-api-'))
    store = new MailStore(dir)
    const raw = Buffer.from('From: sender@example.test\r\nSubject: attachment\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary=x\r\n\r\n--x\r\nContent-Type: text/html\r\n\r\n<p>Full body</p>\r\n--x\r\nContent-Type: application/pdf\r\nContent-Disposition: attachment; filename="contract.pdf"\r\n\r\n%PDF-fixture\r\n--x--')
    const request = (async () => ({ id: 'a1', threadId: 'b1', raw: raw.toString('base64url') })) as GmailRequest
    app = createMailApi(new MailService(store, request))
  })
  afterEach(() => { store.close(); rmSync(dir, { recursive: true, force: true }) })
  const request = (method: string, body?: unknown) => ({ method, headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' }, ...(body !== undefined && { body: JSON.stringify(body) }) })

  it('配置不暴露 secret，拒绝非当前站点回调与无效客户端', async () => {
    expect((await app.request('/account', request('PUT', config))).status).toBe(200)
    const status = await (await app.request('/account')).text()
    expect(status).not.toContain('fixture-secret')
    expect(status).toContain('fixture.apps.googleusercontent.com')
    expect((await app.request('/account', request('PUT', { ...config, redirectUri: 'https://other.example.test/api/apps/mail/oauth/callback' }))).status).toBe(400)
    expect((await app.request('/account', request('PUT', { ...config, clientId: 'invalid' }))).status).toBe(400)
  })

  it('OAuth 使用 PKCE、随机 state 和 HttpOnly 浏览器 cookie，拒绝伪造回调', async () => {
    store.saveAccount(config)
    const response = await app.request('/oauth/start', request('POST'))
    const { url } = await response.json() as { url: string }
    const params = new URL(url).searchParams
    expect(params.get('scope')).toBe('https://www.googleapis.com/auth/gmail.modify')
    expect(params.get('code_challenge_method')).toBe('S256')
    expect(params.get('access_type')).toBe('offline')
    expect(params.get('state')?.length).toBeGreaterThan(32)
    expect(response.headers.get('set-cookie')).toContain('HttpOnly')
    expect(response.headers.get('set-cookie')).toContain('SameSite=Lax')
    expect((await app.request(`/oauth/callback?state=${params.get('state')}&code=forged`)).status).toBe(400)
    const cookie = response.headers.get('set-cookie')!.split(';')[0]
    expect((await app.request('/oauth/callback?state=forged&code=forged', { headers: { Cookie: cookie } })).status).toBe(400)
    const cancelled = await app.request(`/oauth/callback?state=${params.get('state')}&error=access_denied`, { headers: { Cookie: cookie } })
    expect(cancelled.status).toBe(400)
    expect(await cancelled.text()).toContain('Google 授权未完成')
    expect((await app.request(`/oauth/callback?state=${params.get('state')}&code=replayed`, { headers: { Cookie: cookie } })).status).toBe(400)
  })

  it('正文接口返回隔离 HTML，附件和原件以下载形式返回完整字节', async () => {
    const response = await app.request('/messages/a1/body')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect((await response.json() as { html: string }).html).toContain('<p>Full body</p>')
    const file = await app.request('/messages/a1/attachments/0')
    expect(file.headers.get('Content-Disposition')).toContain('attachment;')
    expect(file.headers.get('Content-Type')).toBe('application/pdf')
    expect(await file.text()).toBe('%PDF-fixture')
    const original = await app.request('/messages/a1/original')
    expect(original.headers.get('Content-Type')).toBe('message/rfc822')
    expect(await original.text()).toContain('--x--')
    expect((await app.request('/messages/a1/attachments/999')).status).toBe(404)
    expect((await app.request('/messages/a1/attachments/account.json')).status).toBe(404)
  })

  it('断开连接清除 token、索引和正文缓存，保留 OAuth 配置', async () => {
    store.saveAccount({ ...config, email: 'owner@example.test', tokens: { refresh_token: 'fixture-refresh' } })
    await app.request('/messages/a1/body')
    expect((await app.request('/account', request('DELETE'))).status).toBe(200)
    expect(store.account()).toEqual(config)
    expect(store.summaries()).toEqual([])
    expect(store.detail('a1')).toBeUndefined()
  })
})

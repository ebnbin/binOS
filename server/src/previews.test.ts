import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'

const root = mkdtempSync(path.join(os.tmpdir(), 'binos-test-'))
process.env.BINOS_ROOT = root
delete process.env.BINOS_TEST_INSTANCE
const { previewProxy } = await import('./previews.js')

mkdirSync(path.join(root, 'System', 'previews', 'pr-12'), { recursive: true })
writeFileSync(path.join(root, 'System', 'previews', 'pr-12', 'preview.json'), JSON.stringify({ port: 1, commit: 'x' }))
const app = new Hono().use(previewProxy).get('*', (c) => c.text('正式版'))

describe('previewProxy', () => {
  it('子域名的请求没有 Access 凭证时不转发', async () => {
    expect((await app.request('https://pr-12.binos.app/api/state')).status).toBe(401)
  })

  it('仅安装资源的 GET 请求可转发给预览验证令牌，其他路径和方法仍需登录', async () => {
    const install = 'https://pr-12.binos.app/install/12345678-1234-1234-1234-123456789012/1800000000000.' + 'a'.repeat(43) + '/app.ipa'
    expect((await app.request(install)).status).toBe(502)
    expect((await app.request(install, { method: 'POST' })).status).toBe(401)
    expect((await app.request(install.replace('/app.ipa', '/other'))).status).toBe(401)
    expect((await app.request(install.replace('1800000000000.', 'invalid.'))).status).toBe(401)
  })

  it('binos.app 和其他子域名不经过转发', async () => {
    expect(await (await app.request('https://binos.app/')).text()).toBe('正式版')
    expect(await (await app.request('https://feature.binos.app/')).text()).toBe('正式版')
  })
})

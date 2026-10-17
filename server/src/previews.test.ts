import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'

const root = mkdtempSync(path.join(os.tmpdir(), 'binos-test-'))
process.env.BINOS_ROOT = root
delete process.env.BINOS_TEST_INSTANCE
const { previewProxy } = await import('./previews.js')

mkdirSync(path.join(root, 'System', 'previews', 'feature'), { recursive: true })
writeFileSync(path.join(root, 'System', 'previews', 'feature', 'preview.json'), JSON.stringify({ port: 1, commit: 'x' }))
const app = new Hono().use(previewProxy).get('*', (c) => c.text('正式版'))

describe('previewProxy', () => {
  it('子域名的请求没有 Access 凭证时不转发', async () => {
    expect((await app.request('https://feature.binos.app/api/state')).status).toBe(401)
  })

  it('binos.app 本身不经过转发', async () => {
    expect(await (await app.request('https://binos.app/')).text()).toBe('正式版')
  })
})

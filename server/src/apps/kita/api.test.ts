import { mkdtempSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import type { KitaProfile } from '../../services/kita/profile.js'
import type { Conversation } from './store.js'
const root = mkdtempSync(path.join(os.tmpdir(), 'kita-app-'))
process.env.BINOS_ROOT = root
process.env.BINOS_TEST_INSTANCE = '1'
const { kitaAppApi } = await import('./api.js')
const { forApp } = await import('../../services/kita/index.js')
const { readProfile } = await import('../../services/kita/profile.js')
const app = forApp('kita')
async function request(url: string, method = 'GET', body?: unknown) {
  return kitaAppApi.request(url, { method, ...(body !== undefined && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) })
}
it('手动记忆持久化；新普通对话注入最新快照，临时对话和其他 app 默认不注入', async () => {
  expect((await request('/personality', 'PUT', { text: '测试性格 lunar' })).ok).toBe(true)
  const saved = await (await request('/memories', 'POST', { text: '喜欢 apricot' })).json() as KitaProfile
  const memory = saved.memories[0]
  expect(memory).toMatchObject({ text: '喜欢 apricot', source: 'user' })
  expect(JSON.parse(readFileSync(path.join(root, 'Library/Services/kita/profile.json'), 'utf8')).memories).toHaveLength(1)
  const normal = await (await request('/sessions', 'POST', { agent: 'codex', temporary: false })).json() as Conversation
  expect(app.getSession(normal.id)?.metadata().instructions).toContain('喜欢 apricot')
  expect(app.getSession(normal.id)?.metadata().instructions).toContain('测试性格 lunar')
  expect(app.getSession(normal.id)?.metadata().cwd).toContain('Library/Apps/kita/workspaces')
  await request(`/memories/${memory.id}`, 'PUT', { text: '喜欢 blueberry' })
  const next = await (await request('/sessions', 'POST', { agent: 'codex', temporary: false })).json() as Conversation
  expect(app.getSession(next.id)?.metadata().instructions).toContain('喜欢 blueberry')
  expect(app.getSession(normal.id)?.metadata().instructions).not.toContain('blueberry')
  const temporary = await (await request('/sessions', 'POST', { agent: 'codex', temporary: true })).json() as Conversation
  expect(app.getSession(temporary.id)?.metadata().instructions).toBeUndefined()
  const foreign = forApp('other').createSession({ agent: 'codex', cwd: root })
  expect(foreign.metadata().instructions).toBeUndefined()
  expect((await request(`/sessions/${foreign.id}/messages`, 'POST', { text: 'hello' })).status).toBe(404)
  await request(`/memories/${memory.id}`, 'DELETE')
  expect(readProfile().memories).toEqual([])
  expect((await request(`/memories/${memory.id}`, 'PUT', { text: 'resurrect' })).status).toBe(404)
  expect((await request('/sessions')).status).toBe(200)
})
it('拒绝空记忆、超长内容和非法对话模式', async () => {
  expect((await request('/memories', 'POST', { text: '  ' })).status).toBe(400)
  expect((await request('/memories', 'POST', { text: 'x'.repeat(4001) })).status).toBe(400)
  expect((await request('/personality', 'PUT', { text: '' })).status).toBe(400)
  expect((await request('/sessions', 'POST', { agent: 'other', temporary: false })).status).toBe(400)
  expect((await request('/sessions', 'POST', { agent: 'codex', temporary: 'true' })).status).toBe(400)
})

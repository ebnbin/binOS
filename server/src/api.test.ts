import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

// 以测试实例的方式运行（不校验身份），数据放在临时目录
const root = mkdtempSync(path.join(os.tmpdir(), 'binos-test-'))
process.env.BINOS_ROOT = root
process.env.BINOS_TEST_INSTANCE = '1'
const { api } = await import('./api.js')
const { appendEntry, createSession, filesDir, readTranscript } = await import('./sessions.js')

let sessionId: number
beforeAll(() => {
  sessionId = createSession({ claudeSessionId: 'test' })
  mkdirSync(filesDir(sessionId), { recursive: true })
  writeFileSync(path.join(filesDir(sessionId), 'a-0.png'), 'png')
  writeFileSync(path.join(root, 'Library', 'secret.png'), 'secret')
})

const post = (url: string, body: string, contentType = 'application/json') =>
  api.request(url, { method: 'POST', body, headers: { 'Content-Type': contentType } })

describe('api', () => {
  it('health 返回版本', async () => {
    expect(await (await api.request('/api/health')).json()).toEqual({ version: 'dev' })
  })

  it('写操作只接受 JSON', async () => {
    expect((await post('/api/sessions', 'text=hi', 'application/x-www-form-urlencoded')).status).toBe(415)
    expect((await post(`/api/sessions/${sessionId}/stop`, '', 'text/plain')).status).toBe(415)
  })

  it('消息不能为空', async () => {
    expect((await post('/api/sessions', JSON.stringify({ text: '  ' }))).status).toBe(400)
    expect((await post('/api/sessions', '{bad')).status).toBe(400)
  })

  it('不存在的 session 返回 404', async () => {
    expect((await post('/api/sessions/999/messages', JSON.stringify({ text: 'hi' }))).status).toBe(404)
    expect((await post('/api/sessions/abc/stop', '{}')).status).toBe(404)
    expect((await api.request('/api/sessions/999/stream')).status).toBe(404)
  })

  it('没有回答在进行时停止返回 404', async () => {
    expect((await post(`/api/sessions/${sessionId}/stop`, '{}')).status).toBe(404)
  })

  it('只提供 files/ 里的文件', async () => {
    const res = await api.request(`/api/sessions/${sessionId}/files/a-0.png`)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/png')
    expect(await res.text()).toBe('png')
    expect((await api.request(`/api/sessions/${sessionId}/files/..%2F..%2Fsecret.png`)).status).toBe(404)
    expect((await api.request(`/api/sessions/${sessionId}/files/missing.png`)).status).toBe(404)
  })

  it('session 列表包含标题', async () => {
    appendEntry(sessionId, { type: 'user', message: { role: 'user', content: '第一条消息' } })
    const { sessions } = (await (await api.request('/api/sessions')).json()) as { sessions: { id: number; title: string }[] }
    expect(sessions).toContainEqual(expect.objectContaining({ id: sessionId, title: '第一条消息' }))
  })
})

describe('appendEntry', () => {
  it('按顺序追加，parentUuid 指向上一条', () => {
    const id = createSession({ claudeSessionId: 'test' })
    const first = appendEntry(id, { type: 'user', message: { role: 'user', content: '一' } })
    const second = appendEntry(id, { type: 'system', subtype: 'error', content: '二' })
    expect([first.index, second.index]).toEqual([0, 1])
    expect(first.entry.parentUuid).toBeNull()
    expect(second.entry.parentUuid).toBe(first.entry.uuid)
    expect(readTranscript(id)).toEqual([first.entry, second.entry])
  })
})

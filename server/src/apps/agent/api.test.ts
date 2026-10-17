import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

const root = mkdtempSync(path.join(os.tmpdir(), 'binos-test-'))
process.env.BINOS_ROOT = root
process.env.BINOS_TEST_INSTANCE = '1'
const { api } = await import('../../api.js')
const { appendEntry, createSession, filesDir, readTranscript } = await import('./sessions.js')

let sessionId: number
beforeAll(() => {
  sessionId = createSession({ claudeSessionId: 'test' })
  mkdirSync(filesDir(sessionId), { recursive: true })
  writeFileSync(path.join(filesDir(sessionId), 'a-0.png'), 'png')
  writeFileSync(path.join(filesDir(sessionId), 'page.html'), '<script></script>')
  writeFileSync(path.join(root, 'Library', 'secret.png'), 'secret')
})

const post = (url: string, body: string, contentType: string) =>
  api.request(url, { method: 'POST', body, headers: { 'Content-Type': contentType } })

describe('api', () => {
  it('写操作只接受 JSON', async () => {
    expect((await post('/api/apps/agent/sessions', 'text=hi', 'application/x-www-form-urlencoded')).status).toBe(415)
    expect((await post(`/api/apps/agent/sessions/${sessionId}/stop`, '', 'text/plain')).status).toBe(415)
  })

  it('附件超过上限时拒绝，不留下文件', async () => {
    const res = await api.request('/api/apps/agent/uploads', {
      method: 'POST',
      body: new Uint8Array(50 * 1024 * 1024 + 1),
      headers: { 'Content-Type': 'application/octet-stream' },
    })
    expect(res.status).toBe(413)
    expect(readdirSync(path.join(root, 'Library', 'agent', 'uploads'))).toEqual([])
  })

  it('消息只能带上传过的附件', async () => {
    const upload = await api.request('/api/apps/agent/uploads', {
      method: 'POST',
      body: 'hi',
      headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent('笔记.txt') },
    })
    const { file } = (await upload.json()) as { file: string }
    expect(file).toMatch(/^[0-9a-f]{32}\.txt$/)
    for (const attachments of [[{ file: 'missing.txt', name: 'a' }], [{ file: '../session.json', name: 'a' }], [{ file }, { file }]]) {
      expect((await post('/api/apps/agent/sessions', JSON.stringify({ text: '', attachments }), 'application/json')).status).toBe(400)
    }
  })

  it('网页类文件只能下载，不在页面里打开', async () => {
    const html = await api.request(`/api/apps/agent/sessions/${sessionId}/files/page.html?name=${encodeURIComponent('页面.html')}`)
    expect(html.headers.get('Content-Type')).toBe('application/octet-stream')
    expect(html.headers.get('Content-Disposition')).toBe(`attachment; filename*=UTF-8''${encodeURIComponent('页面.html')}`)
    const image = await api.request(`/api/apps/agent/sessions/${sessionId}/files/a-0.png`)
    expect(image.headers.get('Content-Disposition')).toBe('inline')
  })

  it('只提供 files/ 里的文件', async () => {
    const res = await api.request(`/api/apps/agent/sessions/${sessionId}/files/a-0.png`)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('png')
    expect((await api.request(`/api/apps/agent/sessions/${sessionId}/files/..%2F..%2Fsecret.png`)).status).toBe(404)
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

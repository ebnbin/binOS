import { appendFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

const root = mkdtempSync(path.join(os.tmpdir(), 'binos-test-'))
process.env.BINOS_ROOT = root
process.env.BINOS_TEST_INSTANCE = '1'
const { api } = await import('../../api.js')
const { appendRecords, createSession, filesDir, readTranscript, sessionDir, sessionInfo } = await import('./sessions.js')
const user = (text: string) => ({ type: 'user' as const, time: new Date().toISOString(), text })

let sessionId: number
beforeAll(() => {
  sessionId = createSession(user('测试'))
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

describe('sessions', () => {
  it('session.json 和 transcript 对不上时从头重算', () => {
    const id = createSession(user('一'))
    expect(appendRecords(id, [user('二'), user('三')])).toBe(1)
    expect(sessionInfo(id)).toMatchObject({ count: 3, turns: 3, title: '一' })
    rmSync(`${sessionDir(id)}/session.json`)
    appendFileSync(`${sessionDir(id)}/transcript.jsonl`, JSON.stringify(user('四')) + '\n')
    expect(sessionInfo(id)).toMatchObject({ count: 4, turns: 4 })
  })

  it('跳过崩溃时没写完的半行，之后的记录另起一行', () => {
    const id = createSession(user('一'))
    appendFileSync(`${sessionDir(id)}/transcript.jsonl`, '{"type":"us')
    expect(appendRecords(id, [user('二')])).toBe(1)
    expect(readTranscript(id).map((record) => record.type === 'user' && record.text)).toEqual(['一', '二'])
    expect(readFileSync(`${sessionDir(id)}/transcript.jsonl`, 'utf8').split('\n')).toHaveLength(4)
  })
})

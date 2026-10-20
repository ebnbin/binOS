import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

const root = mkdtempSync(path.join(os.tmpdir(), 'binos-test-'))
process.env.BINOS_ROOT = root
process.env.BINOS_TEST_INSTANCE = '1'
const { api } = await import('../../api.js')
const { appendItems, createThread, filesDir } = await import('../../services/agent/store.js')
const { createSession, readSession, searchSessions, sessionTitle, setUserState } = await import('./sessions.js')
const time = () => new Date().toISOString()

// 新的 session 和它的 thread，第一句是 text
function newSession(text: string) {
  const thread = createThread({ type: 'thread', time: time(), agent: 'claude', owner: 'code', cwd: root })
  appendItems(thread, [{ type: 'input', time: time(), mode: 'start', text }])
  return { thread, id: createSession(thread) }
}

let thread: string
beforeAll(() => {
  thread = newSession('测试').thread
  mkdirSync(filesDir(thread), { recursive: true })
  writeFileSync(path.join(filesDir(thread), 'a-0.png'), 'png')
  writeFileSync(path.join(filesDir(thread), 'page.html'), '<script></script>')
  writeFileSync(path.join(root, 'Library', 'secret.png'), 'secret')
})

const post = (url: string, body: string, contentType: string) =>
  api.request(url, { method: 'POST', body, headers: { 'Content-Type': contentType } })

describe('api', () => {
  it('写操作只接受 JSON', async () => {
    expect((await post('/api/apps/code/sessions', 'text=hi', 'application/x-www-form-urlencoded')).status).toBe(415)
    expect((await post('/api/apps/code/sessions/1/stop', '', 'text/plain')).status).toBe(415)
  })

  it('附件超过上限时拒绝，不留下文件', async () => {
    const res = await api.request('/api/apps/code/uploads', {
      method: 'POST',
      body: new Uint8Array(50 * 1024 * 1024 + 1),
      headers: { 'Content-Type': 'application/octet-stream' },
    })
    expect(res.status).toBe(413)
    expect(readdirSync(path.join(root, 'Library', 'Apps', 'code', 'uploads'))).toEqual([])
  })

  it('消息只能带上传过的附件', async () => {
    const upload = await api.request('/api/apps/code/uploads', {
      method: 'POST',
      body: 'hi',
      headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent('笔记.txt') },
    })
    const { file } = (await upload.json()) as { file: string }
    expect(file).toMatch(/^[0-9a-f]{32}\.txt$/)
    for (const attachments of [[{ file: 'missing.txt', name: 'a' }], [{ file: '../session.json', name: 'a' }], [{ file }, { file }]]) {
      expect((await post('/api/apps/code/sessions', JSON.stringify({ text: '', attachments }), 'application/json')).status).toBe(400)
    }
  })

  it('thread 里网页类的文件只能下载，不在页面里打开', async () => {
    const html = await api.request(`/api/agent/threads/${thread}/files/page.html?name=${encodeURIComponent('页面.html')}`)
    expect(html.headers.get('Content-Type')).toBe('application/octet-stream')
    expect(html.headers.get('Content-Disposition')).toBe(`attachment; filename*=UTF-8''${encodeURIComponent('页面.html')}`)
    const image = await api.request(`/api/agent/threads/${thread}/files/a-0.png`)
    expect(image.headers.get('Content-Disposition')).toBe('inline')
  })

  it('文件流支持范围读取、元数据和强制下载', async () => {
    const url = `/api/agent/threads/${thread}/files/a-0.png`
    const range = await api.request(url, { headers: { Range: 'bytes=1-2' } })
    expect(range.status).toBe(206)
    expect(range.headers.get('Content-Range')).toBe('bytes 1-2/3')
    expect(await range.text()).toBe('ng')
    const suffix = await api.request(url, { headers: { Range: 'bytes=-1' } })
    expect(await suffix.text()).toBe('g')
    for (const value of ['bytes=3-', 'bytes=2-1', 'bytes=-', 'bytes=0-1,2-3']) {
      expect((await api.request(url, { headers: { Range: value } })).status).toBe(416)
    }
    const metadata = await api.request(url + '?info=1')
    expect(await metadata.json()).toMatchObject({ size: 3, type: 'image/png' })
    const download = await api.request(url + '?name=photo.png')
    expect(download.headers.get('Content-Disposition')).toBe("attachment; filename*=UTF-8''photo.png")
    writeFileSync(path.join(filesDir(thread), 'empty'), '')
    const empty = await api.request(`/api/agent/threads/${thread}/files/empty`)
    expect(empty.status).toBe(200)
    expect(await empty.text()).toBe('')
  })

  it('只提供 thread 的 files/ 里的文件', async () => {
    const res = await api.request(`/api/agent/threads/${thread}/files/a-0.png`)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('png')
    expect((await api.request(`/api/agent/threads/${thread}/files/..%2F..%2Fsecret.png`)).status).toBe(404)
    expect((await api.request('/api/agent/threads/..%2F..%2F/files/a-0.png')).status).toBe(404)
  })
})

describe('sessions', () => {
  it('标题默认是第一句话，改名后用改的名字；用户的整理和 thread 新增的条目互不影响', () => {
    const { thread, id } = newSession('原来的名字')
    setUserState(id, { pinned: true, title: '新名字' })
    appendItems(thread, [{ type: 'input', time: time(), mode: 'start', text: '第二轮' }])
    expect(readSession(id)).toMatchObject({ pinned: true, title: '新名字', defaultTitle: '原来的名字' })
    setUserState(id, { title: undefined })
    expect(sessionTitle(readSession(id))).toBe('原来的名字')
  })

  it('按标题、用户的话和回复搜索，不看子 agent 的文字', () => {
    const { thread, id } = newSession('Alpha 计划')
    appendItems(thread, [
      { type: 'text', time: time(), text: '关于 Beta 的回复' },
      { type: 'text', time: time(), text: 'Gamma', parent: 't1' },
    ])
    expect(searchSessions([id], 'alpha').has(id)).toBe(true)
    expect(searchSessions([id], 'BETA').has(id)).toBe(true)
    expect(searchSessions([id], 'gamma').has(id)).toBe(false)
  })

  it('记下 gh pr create 输出的 PR，别的命令输出里的 PR 链接不算', () => {
    const { thread, id } = newSession('开个 PR')
    const pr = 'https://github.com/ebnbin/binos/pull/41'
    const command = (callId: string, text: string) =>
      ({ type: 'tool_call', time: time(), id: callId, name: 'Bash', tool: { kind: 'command', command: text } }) as const
    appendItems(thread, [
      command('t1', 'git push && gh pr create --fill && pnpm preview'),
      command('t2', 'gh pr view 40'),
      { type: 'tool_result', time: time(), callId: 't2', status: 'done', output: 'https://github.com/ebnbin/binos/pull/40' },
      { type: 'tool_result', time: time(), callId: 't1', status: 'done', output: `${pr}\n✓ PR #41 的预览：https://pr-41.binos.app` },
    ])
    expect(readSession(id)).toMatchObject({ prs: [pr], creatingPrs: [] })
  })
})

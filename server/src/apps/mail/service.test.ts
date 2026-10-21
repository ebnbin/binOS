import { mkdtempSync, rmSync, statSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MailError } from './gmail.js'
import type { GmailRequest } from './gmail.js'
import { MailService } from './service.js'
import { MailStore } from './store.js'

const mail = (id: string, labels = ['INBOX', 'UNREAD']) => ({
  id, threadId: 'thread1', labelIds: labels, internalDate: id === 'a1' ? '1700000000000' : '1700000001000',
  payload: { headers: [{ name: 'Subject', value: 'Test email' }] },
  raw: Buffer.from('From: sender@example.test\r\nTo: owner@example.test\r\nSubject: Test email\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<p>Complete message</p>').toString('base64url'),
})

describe('Gmail 同步与缓存', () => {
  let dir: string
  let store: MailStore
  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'binos-mail-'))
    store = new MailStore(dir)
    store.saveAccount({ clientId: 'test.apps.googleusercontent.com', clientSecret: 'test', redirectUri: 'http://localhost/api/apps/mail/oauth/callback', email: 'owner@example.test', tokens: { refresh_token: 'fixture' } })
  })
  afterEach(() => { store.close(); rmSync(dir, { recursive: true, force: true }) })

  function service(handler: (resource: string, options?: { method?: string; data?: unknown }) => unknown | Promise<unknown>) {
    return new MailService(store, (async (resource, options) => handler(resource, options)) as GmailRequest)
  }

  it('首次同步先记录基线、保留完整原件，重启后继续增量同步', async () => {
    const calls: string[] = []
    const first = service((resource) => {
      calls.push(resource)
      if (resource === 'profile') return { historyId: '100' }
      if (resource.startsWith('messages?')) return { messages: [{ id: 'a1' }] }
      if (resource.startsWith('messages/a1')) return mail('a1')
      throw new Error(resource)
    })
    await first.sync()
    expect(calls[0]).toBe('profile')
    expect(store.getState('historyId')).toBe('100')
    expect(store.content('a1', 'original.eml').toString()).toContain('<p>Complete message</p>')
    expect(statSync(path.join(dir, 'account.json')).mode & 0o777).toBe(0o600)
    store.close()
    store = new MailStore(dir)
    const next = service((resource) => {
      if (resource.startsWith('history?')) return { historyId: '110', history: [{ labelsRemoved: [{ message: { id: 'a1' } }] }] }
      if (resource.startsWith('messages/a1')) return mail('a1', ['INBOX'])
      throw new Error(resource)
    })
    await next.sync()
    expect(store.getState('historyId')).toBe('110')
    expect(store.detail('a1')?.labels).toEqual(['INBOX'])
    expect(store.detail('a1')?.html).toContain('Complete message')
  })

  it('分页同步失败不推进游标，重试时可以重放变更', async () => {
    store.setState('historyId', '100')
    const instance = service((resource) => {
      if (resource.includes('pageToken=next')) throw new MailError('offline')
      if (resource.startsWith('history?')) return { historyId: '110', nextPageToken: 'next', history: [{ messagesAdded: [{ message: { id: 'a1' } }] }] }
      if (resource.startsWith('messages/a1')) return mail('a1')
      throw new Error(resource)
    })
    await expect(instance.sync()).rejects.toThrow('offline')
    expect(store.getState('historyId')).toBe('100')
    expect(instance.status().error).toBe('offline')
  })

  it('历史游标过期时重建基线并移除已经删除的缓存', async () => {
    store.setState('historyId', '100')
    store.saveSummary({ id: 'deleted', threadId: 'thread1', subject: '', from: '', to: '', date: 0, labels: [], snippet: '' })
    const instance = service((resource) => {
      if (resource.startsWith('history?') || resource.startsWith('messages/deleted')) throw new MailError('expired', 404)
      if (resource === 'profile') return { historyId: '200' }
      if (resource.startsWith('messages?')) return { messages: [{ id: 'a1' }] }
      if (resource.startsWith('messages/a1')) return mail('a1')
      throw new Error(resource)
    })
    await instance.sync()
    expect(store.getState('historyId')).toBe('200')
    expect(store.summaries().map((item) => item.id)).toEqual(['a1'])
  })

  it('完整会话包含已发送回复，并在离线时返回明确标记的缓存', async () => {
    let offline = false
    const instance = service((resource) => {
      if (offline) throw new MailError('offline')
      if (resource.startsWith('threads/thread1?')) return { messages: [mail('a1'), mail('a2', ['SENT'])] }
      if (resource.startsWith('messages/a1')) return mail('a1')
      if (resource.startsWith('messages/a2')) return mail('a2', ['SENT'])
      throw new Error(resource)
    })
    const thread = await instance.thread('thread1')
    expect(thread.messages.map((item) => item.id)).toEqual(['a1', 'a2'])
    expect(thread.messages[1].labels).toEqual(['SENT'])
    offline = true
    expect((await instance.thread('thread1')).cached).toBe(true)
    store.remove('a2')
    await expect(instance.thread('thread1')).rejects.toThrow('offline')
  })

  it('搜索和分页交给 Gmail，缓存按查询与页码隔离', async () => {
    let offline = false
    const instance = service((resource) => {
      if (offline) throw new MailError('offline')
      if (resource.startsWith('threads?')) return { threads: [{ id: 'thread1' }], nextPageToken: 'page2' }
      if (resource.startsWith('threads/thread1?')) return { messages: [mail('a1'), mail('a2', ['SENT'])] }
      throw new Error(resource)
    })
    const page = await instance.list('from:sender')
    expect(page.next).toBe('page2')
    expect(page.threads[0].labels).toContain('UNREAD')
    offline = true
    expect((await instance.list('from:sender')).cached).toBe(true)
    await expect(instance.list('other query')).rejects.toThrow('offline')
    await expect(instance.list('from:sender', 'page2')).rejects.toThrow('offline')
  })

  it('已读状态先写 Gmail，成功后才更新缓存', async () => {
    let fail = true
    let modified: unknown
    const instance = service((resource, options) => {
      if (resource.startsWith('messages/')) return mail('a1')
      if (resource.endsWith('/modify')) { modified = options?.data; if (fail) throw new MailError('offline'); return {} }
      throw new Error(resource)
    })
    await instance.message('a1')
    await expect(instance.markRead('thread1', true)).rejects.toThrow('offline')
    expect(modified).toEqual({ removeLabelIds: ['UNREAD'] })
    expect(store.detail('a1')?.labels).toContain('UNREAD')
    fail = false
    await instance.markRead('thread1', true)
    expect(store.detail('a1')?.labels).not.toContain('UNREAD')
  })

  it('合并重复同步请求，并让断开任务等待在途读写结束', async () => {
    let resume: () => void = () => {}
    const waiting = new Promise<void>((resolve) => { resume = resolve })
    const instance = service(async (resource) => {
      if (resource === 'profile') { await waiting; return { historyId: '100' } }
      if (resource.startsWith('messages?')) return {}
      throw new Error(resource)
    })
    const first = instance.sync()
    expect(instance.sync()).toBe(first)
    const disconnected = instance.run(async () => store.clear())
    resume()
    await Promise.all([first, disconnected])
    expect(store.getState('historyId')).toBeUndefined()
  })

  it('并行读取列表时，一个请求失败后仍等待其他请求结束再断开账号', async () => {
    let resume: () => void = () => {}
    let started: () => void = () => {}
    const waiting = new Promise<void>((resolve) => { resume = resolve })
    const entered = new Promise<void>((resolve) => { started = resolve })
    const instance = service(async (resource) => {
      if (resource.startsWith('threads?')) return { threads: [{ id: 'thread1' }, { id: 'thread2' }] }
      if (resource.startsWith('threads/thread1?')) throw new MailError('offline')
      if (resource.startsWith('threads/thread2?')) { started(); await waiting; return { messages: [mail('a1')] } }
      throw new Error(resource)
    })
    const listing = instance.run(() => instance.list('in:inbox')).catch(() => {})
    let cleared = false
    const disconnected = instance.run(async () => { store.clear(); cleared = true })
    await entered
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(cleared).toBe(false)
    resume()
    await Promise.all([listing, disconnected])
    expect(cleared).toBe(true)
    expect(store.summaries()).toEqual([])
  })

  it('拒绝带路径的邮件和会话标识', async () => {
    const instance = service(() => { throw new Error('must not request') })
    await expect(instance.message('../account.json')).rejects.toMatchObject({ status: 400 })
    await expect(instance.thread('../account.json')).rejects.toMatchObject({ status: 400 })
  })
})

import { parseMessage, parseSummary } from './content.js'
import { gmailRequest, MailError } from './gmail.js'
import type { GmailRequest } from './gmail.js'
import type { MailStore } from './store.js'
import type { GmailMessage, MailPage, MailStatus, MailThread } from './types.js'

export const gmailId = (id: string) => /^[a-zA-Z0-9_-]{1,128}$/.test(id)
type HistoryPage = { historyId: string; nextPageToken?: string; history?: { messages?: { id: string }[]; messagesDeleted?: { message: { id: string } }[]; messagesAdded?: { message: { id: string } }[]; labelsAdded?: { message: { id: string } }[]; labelsRemoved?: { message: { id: string } }[] }[] }

async function mapConcurrent<T, R>(items: T[], operation: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const settled = await Promise.allSettled(Array.from({ length: Math.min(4, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await operation(items[index])
    }
  }))
  const failed = settled.find((result) => result.status === 'rejected')
  if (failed?.status === 'rejected') throw failed.reason
  return results
}

export class MailService {
  private queue: Promise<unknown> = Promise.resolve()
  private syncing?: Promise<void>
  private lastError?: string
  private failures = 0
  private nextAttempt = 0
  readonly request: GmailRequest
  readonly store: MailStore
  private changed: () => void
  constructor(store: MailStore, request?: GmailRequest, changed: () => void = () => {}) {
    this.store = store
    this.changed = changed
    this.request = request ?? gmailRequest(store)
  }

  run<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation)
    this.queue = result.catch(() => {})
    return result
  }

  status(): MailStatus {
    const account = this.store.account()
    return {
      configured: Boolean(account), connected: Boolean(account?.tokens?.refresh_token), email: account?.email,
      clientId: account?.clientId, redirectUri: account?.redirectUri,
      lastSync: account ? Number(this.store.getState('lastSync')) || undefined : undefined,
      error: this.lastError, syncing: Boolean(this.syncing),
    }
  }

  resetError() { this.lastError = undefined; this.failures = 0; this.nextAttempt = 0 }

  private async metadata(id: string) {
    if (!gmailId(id)) throw new MailError('邮件标识无效', 400)
    const message = await this.request<GmailMessage>(`messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`)
    this.store.saveSummary(await parseSummary(message))
    return message
  }

  async message(id: string) {
    if (!gmailId(id)) throw new MailError('邮件标识无效', 400)
    const cached = this.store.detail(id)
    if (cached) return cached
    const message = await this.request<GmailMessage>(`messages/${id}?format=raw`)
    if (!message.raw) throw new MailError('Gmail 未返回完整邮件，请重试')
    const raw = Buffer.from(message.raw, 'base64url')
    const { detail, attachments } = await parseMessage(message, raw)
    this.store.writeContent(id, 'original.eml', raw)
    attachments.forEach((item, index) => this.store.writeContent(id, `${index}`, item.content))
    this.store.saveDetail(detail)
    return detail
  }

  async list(query: string, page = ''): Promise<MailPage> {
    const key = JSON.stringify([query, page])
    try {
      const params = new URLSearchParams({ maxResults: '50', q: query, ...(page && { pageToken: page }) })
      const result = await this.request<{ threads?: { id: string }[]; nextPageToken?: string }>(`threads?${params}`)
      const threads = await mapConcurrent(result.threads ?? [], async (item) => {
        if (!gmailId(item.id)) throw new MailError('Gmail 返回无效的会话标识')
        const thread = await this.request<{ messages?: GmailMessage[] }>(`threads/${item.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`)
        const messages = thread.messages ?? []
        const summaries = []
        for (const message of messages) {
          const parsed = await parseSummary(message)
          this.store.saveSummary(parsed)
          summaries.push(parsed)
        }
        const selected = summaries.sort((a, b) => b.date - a.date)[0]
        if (selected) {
          const row = { ...selected }
          row.labels = [...new Set(messages.flatMap((message) => message.labelIds ?? []))]
          return { ...row, id: item.id, threadId: item.id }
        }
        return undefined
      })
      const resultPage: MailPage = { threads: threads.filter((item) => item !== undefined), next: result.nextPageToken }
      this.store.savePage(key, resultPage)
      return resultPage
    } catch (error) {
      const cached = this.store.page(key)
      if (cached && (!(error instanceof MailError) || error.status >= 500 || error.status === 429 || error.status === 401)) return { ...cached, cached: true }
      throw error
    }
  }

  async thread(id: string): Promise<MailThread> {
    if (!gmailId(id)) throw new MailError('会话标识无效', 400)
    try {
      const result = await this.request<{ messages?: GmailMessage[] }>(`threads/${id}?format=minimal`)
      const messages = []
      for (const item of result.messages ?? []) {
        const message = await this.message(item.id)
        const updated = { ...message, labels: item.labelIds ?? message.labels }
        this.store.saveDetail(updated)
        messages.push(updated)
      }
      const current = new Set(messages.map((message) => message.id))
      for (const cached of this.store.cachedThread(id)) if (!current.has(cached.id)) this.store.remove(cached.id)
      this.store.setState(`thread:${id}`, JSON.stringify([...current]))
      return { id, messages: messages.sort((a, b) => a.date - b.date) }
    } catch (error) {
      const expected = this.store.getState(`thread:${id}`)
      const cached = this.store.cachedThread(id)
      if (expected && cached.length && JSON.stringify(cached.map((message) => message.id).sort()) === JSON.stringify((JSON.parse(expected) as string[]).sort()) && (!(error instanceof MailError) || error.status !== 404)) return { id, messages: cached, cached: true }
      throw error
    }
  }

  async markRead(id: string, read: boolean) {
    if (!gmailId(id)) throw new MailError('会话标识无效', 400)
    await this.request(`threads/${id}/modify`, { method: 'POST', data: read ? { removeLabelIds: ['UNREAD'] } : { addLabelIds: ['UNREAD'] } })
    for (const message of this.store.summaries().filter((message) => message.threadId === id)) {
      this.store.saveSummary({ ...message, labels: read ? message.labels.filter((label) => label !== 'UNREAD') : [...new Set([...message.labels, 'UNREAD'])] })
    }
    this.changed()
  }

  private async baseline() {
    // 先记游标再读列表，列表加载期间发生的变化仍会在下一轮 history 同步中处理。
    const profile = await this.request<{ historyId: string }>('profile')
    for (const item of this.store.summaries()) {
      try { await this.metadata(item.id) } catch (error) {
        if (error instanceof MailError && error.status === 404) this.store.remove(item.id)
        else throw error
      }
    }
    const recent = await this.request<{ messages?: { id: string }[] }>('messages?maxResults=50&labelIds=INBOX')
    for (const item of recent.messages ?? []) await this.metadata(item.id)
    for (const item of (recent.messages ?? []).slice(0, 5)) await this.message(item.id)
    this.store.setState('historyId', profile.historyId)
  }

  private async incremental(start: string) {
    let page: string | undefined
    let historyId = start
    do {
      const params = new URLSearchParams({ startHistoryId: start, ...(page && { pageToken: page }), maxResults: '100' })
      const result = await this.request<HistoryPage>(`history?${params}`)
      const ids = new Set<string>()
      for (const history of result.history ?? []) {
        for (const item of history.messages ?? []) ids.add(item.id)
        for (const field of ['messagesDeleted', 'messagesAdded', 'labelsAdded', 'labelsRemoved'] as const) for (const item of history[field] ?? []) ids.add(item.message.id)
      }
      for (const id of ids) {
        try { await this.metadata(id) } catch (error) {
          if (error instanceof MailError && error.status === 404) this.store.remove(id)
          else throw error
        }
      }
      page = result.nextPageToken
      historyId = result.historyId
    } while (page)
    this.store.setState('historyId', historyId)
  }

  sync(): Promise<void> {
    if (this.syncing) return this.syncing
    this.syncing = this.run(async () => {
      if (!this.store.account()?.tokens?.refresh_token) return
      try {
        const start = this.store.getState('historyId')
        if (start) {
          try { await this.incremental(start) } catch (error) {
            if (error instanceof MailError && error.status === 404) await this.baseline()
            else throw error
          }
        } else await this.baseline()
        this.store.setState('lastSync', String(Date.now()))
        this.resetError()
      } catch (error) {
        this.lastError = error instanceof MailError ? error.message : '邮件同步失败，请重试'
        this.nextAttempt = Date.now() + Math.min(60_000 * 2 ** this.failures++, 15 * 60_000)
        throw error
      }
    }).finally(() => { this.syncing = undefined; this.changed() })
    return this.syncing
  }

  start() {
    const tick = () => { if (Date.now() >= this.nextAttempt && this.store.account()?.tokens?.refresh_token) void this.sync().catch(() => {}) }
    tick()
    const timer = setInterval(tick, 60_000)
    timer.unref()
    return () => clearInterval(timer)
  }
}

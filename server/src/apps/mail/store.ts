import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { Credentials } from 'google-auth-library'
import type { MailMessage, MailPage, MailSummary } from './types.js'

export type Account = { clientId: string; clientSecret: string; redirectUri: string; tokens?: Credentials; email?: string }

export class MailStore {
  private database?: DatabaseSync
  readonly dir: string
  constructor(dir: string) { this.dir = dir }

  private prepare() {
    mkdirSync(this.dir, { recursive: true, mode: 0o700 })
    chmodSync(this.dir, 0o700)
  }

  private db() {
    if (!this.database) {
      this.prepare()
      this.database = new DatabaseSync(path.join(this.dir, 'mail.sqlite'))
      this.database.exec(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, thread TEXT NOT NULL, date INTEGER NOT NULL, summary TEXT NOT NULL, detail TEXT);
        CREATE INDEX IF NOT EXISTS message_thread ON messages(thread, date);
        CREATE TABLE IF NOT EXISTS pages (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      `)
      chmodSync(path.join(this.dir, 'mail.sqlite'), 0o600)
    }
    return this.database
  }

  account(): Account | undefined {
    const file = path.join(this.dir, 'account.json')
    return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) as Account : undefined
  }

  saveAccount(account: Account) {
    this.prepare()
    const file = path.join(this.dir, 'account.json')
    writeFileSync(`${file}.tmp`, JSON.stringify(account), { mode: 0o600 })
    renameSync(`${file}.tmp`, file)
  }

  getState(key: string): string | undefined {
    return (this.db().prepare('SELECT value FROM state WHERE key = ?').get(key) as { value: string } | undefined)?.value
  }

  setState(key: string, value: string) {
    this.db().prepare('INSERT OR REPLACE INTO state VALUES (?, ?)').run(key, value)
  }

  saveSummary(summary: MailSummary) {
    const previous = this.detail(summary.id)
    this.db().prepare(`INSERT INTO messages VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET
      thread=excluded.thread, date=excluded.date, summary=excluded.summary, detail=excluded.detail`).run(
      summary.id, summary.threadId, summary.date, JSON.stringify(summary), previous ? JSON.stringify({ ...previous, ...summary }) : null,
    )
  }

  saveDetail(message: MailMessage) {
    this.saveSummary(message)
    this.db().prepare('UPDATE messages SET detail = ? WHERE id = ?').run(JSON.stringify(message), message.id)
  }

  detail(id: string): MailMessage | undefined {
    const row = this.db().prepare('SELECT detail FROM messages WHERE id = ?').get(id) as { detail: string | null } | undefined
    return row?.detail ? JSON.parse(row.detail) as MailMessage : undefined
  }

  summaries(): MailSummary[] {
    return (this.db().prepare('SELECT summary FROM messages ORDER BY date DESC').all() as { summary: string }[]).map((row) => JSON.parse(row.summary))
  }

  cachedThread(id: string): MailMessage[] {
    return (this.db().prepare('SELECT detail FROM messages WHERE thread = ? ORDER BY date').all(id) as { detail: string | null }[])
      .filter((row) => row.detail).map((row) => JSON.parse(row.detail!) as MailMessage)
  }

  remove(id: string) {
    this.db().prepare('DELETE FROM messages WHERE id = ?').run(id)
    rmSync(path.join(this.dir, 'content', id), { recursive: true, force: true })
  }

  page(key: string): MailPage | undefined {
    const row = this.db().prepare('SELECT value FROM pages WHERE key = ?').get(key) as { value: string } | undefined
    return row ? JSON.parse(row.value) : undefined
  }

  savePage(key: string, page: MailPage) {
    this.db().prepare('INSERT OR REPLACE INTO pages VALUES (?, ?)').run(key, JSON.stringify(page))
  }

  invalidatePages() { this.db().exec('DELETE FROM pages') }

  writeContent(id: string, file: string, content: Uint8Array) {
    const dir = path.join(this.dir, 'content', id)
    mkdirSync(dir, { recursive: true, mode: 0o700 })
    writeFileSync(path.join(dir, `${file}.tmp`), content, { mode: 0o600 })
    renameSync(path.join(dir, `${file}.tmp`), path.join(dir, file))
  }

  content(id: string, file: string): Buffer {
    return readFileSync(path.join(this.dir, 'content', id, file))
  }

  clear() {
    this.db().exec('DELETE FROM messages; DELETE FROM pages; DELETE FROM state;')
    rmSync(path.join(this.dir, 'content'), { recursive: true, force: true })
  }

  close() { this.database?.close(); this.database = undefined }
}

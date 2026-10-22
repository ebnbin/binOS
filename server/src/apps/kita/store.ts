import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { appDir } from '../../paths.js'
import { forApp } from '../../services/kita/index.js'
import type { AgentId } from '../../services/kita/types.js'

export type Conversation = { id: string; title: string; temporary: boolean; agent: AgentId; createdAt: string }
export const kita = forApp('kita')
const dir = appDir('kita')
const file = path.join(dir, 'conversations.json')
export function conversations(): Conversation[] { return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) as Conversation[] : [] }
export function createConversation(agent: AgentId, temporary: boolean) {
  mkdirSync(path.join(dir, 'workspaces'), { recursive: true })
  const cwd = mkdtempSync(path.join(dir, 'workspaces', 'session-'))
  const session = kita.createSession({ agent, cwd, context: temporary ? 'neutral' : 'personal' })
  const conversation: Conversation = { id: session.id, title: temporary ? '临时对话' : '新的对话', temporary, agent, createdAt: new Date().toISOString() }
  save([conversation, ...conversations()])
  return conversation
}
function save(value: Conversation[]) {
  writeFileSync(`${file}.tmp`, JSON.stringify(value, null, 2) + '\n', { flush: true })
  renameSync(`${file}.tmp`, file)
}
export function titleConversation(id: string, text: string) {
  save(conversations().map((c) => c.id === id ? { ...c, title: text.replace(/\s+/g, ' ').trim().slice(0, 48) } : c))
}

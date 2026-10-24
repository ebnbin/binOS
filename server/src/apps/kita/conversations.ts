import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { notifyChange } from '../../events.js'
import { appDir } from '../../paths.js'
import { forApp } from '../../services/kita/index.js'
import type { KitaSession } from '../../services/kita/index.js'
import { transcriptPrompt } from '../../services/kita/transcript-prompt.js'
import { defaultAgent } from '../../services/kita/types.js'
import type { Conversation } from './types.js'

export const kita = forApp('kita')

// agent 在这里干活，和 binOS 的代码分开
const workspace = path.join(appDir('kita'), 'workspace')

// 喜多 app 的对话读写个人范围的记忆
const identity = { read: ['personal'], write: 'personal' }

// 一轮开始和结束时通知页面重新读取列表
kita.onEvent((_session, event) => {
  if (event.type === 'event' && (event.event.data.type === 'input' || event.event.data.type === 'turn_end')) {
    notifyChange({ type: 'kita' })
  }
})

function conversation(session: KitaSession): Conversation {
  const summary = session.summary()
  const first = session.entries().find((entry) => entry.type === 'input')
  return {
    id: session.id,
    title: (first?.type === 'input' ? first.text.trim() : '').slice(0, 100),
    temporary: !session.metadata().identity,
    state: summary.state,
    createdAt: summary.createdAt,
    updatedAt: summary.updatedAt,
    ...(summary.outcome && { outcome: summary.outcome }),
  }
}

export const listConversations = () => kita.listSessions().map(conversation).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

// 返回对话的 id；交不过去时返回 undefined
export async function startConversation(text: string, temporary: boolean): Promise<string | undefined> {
  mkdirSync(workspace, { recursive: true })
  const session = kita.createSession({ agent: defaultAgent, cwd: workspace, instructions: transcriptPrompt, ...(!temporary && { identity }) })
  notifyChange({ type: 'kita' })
  return (await session.send({ text })) ? session.id : undefined
}

// 正在回答时交给 agent，它在下一步看到
export async function sendMessage(id: string, text: string): Promise<boolean> {
  return (await kita.getSession(id)?.send({ text })) ?? false
}

export const stopConversation = (id: string) => kita.getSession(id)?.stop() ?? false

export async function deleteConversation(id: string): Promise<boolean> {
  const deleted = await kita.deleteSession(id)
  if (deleted) notifyChange({ type: 'kita' })
  return deleted
}

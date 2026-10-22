import { Hono } from 'hono'
import { validator } from 'hono/validator'
import { agentIds } from '../../services/kita/types.js'
import type { AgentId } from '../../services/kita/types.js'
import { deleteMemory, readProfile, saveMemory, setPersonality } from '../../services/kita/profile.js'
import { conversations, createConversation, kita, titleConversation } from './store.js'

const textBody = (max: number) => validator('json', (value, c) => {
  const text = (value as { text?: unknown } | null)?.text
  return typeof text === 'string' && text.trim() && text.length <= max ? { text: text.trim() } : c.text('请输入有效内容', 400)
})
const sessionParam = validator('param', (value: Record<string, string>, c) => {
  const id = value.id ?? ''
  return conversations().some((s) => s.id === id) && kita.getSession(id) ? { id } : c.text('Not Found', 404)
})
export const kitaAppApi = new Hono()
  .get('/profile', (c) => c.json(readProfile()))
  .put('/personality', textBody(8000), (c) => c.json(setPersonality(c.req.valid('json').text)))
  .post('/memories', textBody(4000), (c) => c.json(saveMemory(c.req.valid('json').text)!))
  .put('/memories/:id', textBody(4000), (c) => {
    const profile = saveMemory(c.req.valid('json').text, c.req.param('id'))
    return profile ? c.json(profile) : c.text('Not Found', 404)
  })
  .delete('/memories/:id', (c) => {
    const profile = deleteMemory(c.req.param('id'))
    return profile ? c.json(profile) : c.text('Not Found', 404)
  })
  .get('/sessions', (c) => c.json(conversations().map((s) => ({ ...s, state: kita.getSession(s.id)?.state() ?? 'idle' }))))
  .post('/sessions', validator('json', (value, c) => {
    const v = value as { agent?: unknown; temporary?: unknown } | null
    return v && agentIds.includes(v.agent as AgentId) && typeof v.temporary === 'boolean'
      ? { agent: v.agent as AgentId, temporary: v.temporary } : c.text('Bad Request', 400)
  }), (c) => { const v = c.req.valid('json'); return c.json(createConversation(v.agent, v.temporary), 201) })
  .post('/sessions/:id/messages', sessionParam, textBody(32000), async (c) => {
    const id = c.req.valid('param').id, session = kita.getSession(id)!, text = c.req.valid('json').text
    if (session.state() !== 'idle') return c.text('Kita 正在回答，请稍等或先停止', 409)
    const first = session.turns().length === 0
    const accepted = await session.send({ text })
    if (!accepted) return c.text('消息未能发送', 503)
    if (first) titleConversation(id, text)
    return c.json({ ok: true })
  })
  .post('/sessions/:id/stop', sessionParam, (c) => { kita.getSession(c.req.valid('param').id)!.stop(); return c.json({ ok: true }) })
export type KitaAppApi = typeof kitaAppApi

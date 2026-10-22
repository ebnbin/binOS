import type { KitaProfile } from '@binos/server/services/kita/profile'
import type { Conversation } from '@binos/server/apps/kita/types'
import type { AgentId, KitaSessionState } from '@binos/server/services/kita/types'
export type Session = Conversation & { state?: KitaSessionState }
async function request<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(`/api/apps/kita${url}`, { method, ...(method !== 'GET' && { headers: { 'Content-Type': 'application/json' } }), ...(body !== undefined && { body: JSON.stringify(body) }) })
  if (!res.ok) throw Error(await res.text() || '暂时无法连接 Kita')
  return res.json() as Promise<T>
}
export const readProfile = () => request<KitaProfile>('/profile')
export const listSessions = () => request<Session[]>('/sessions')
export const createSession = (agent: AgentId, temporary: boolean) => request<Session>('/sessions', 'POST', { agent, temporary })
export const send = (id: string, text: string) => request(`/sessions/${id}/messages`, 'POST', { text })
export const stop = (id: string) => request(`/sessions/${id}/stop`, 'POST')
export const setPersonality = (text: string) => request<KitaProfile>('/personality', 'PUT', { text })
export const saveMemory = (text: string, id?: string) => request<KitaProfile>(id ? `/memories/${id}` : '/memories', id ? 'PUT' : 'POST', { text })
export const deleteMemory = (id: string) => request<KitaProfile>(`/memories/${id}`, 'DELETE')

import { Hono } from 'hono'
import { notifyChange } from '../../events.js'
import { readSession, sessionExists, sessionOf, sessionTitle } from '../code/sessions.js'
import { deviceRequest } from './client.js'
import { parseRequest } from './protocol.js'
import type { LeaseResult, Snapshot } from './types.js'

let last: string | undefined
export type DevicesSnapshot = Snapshot & { owners: Record<string, { session: number; title: string }> }
async function snapshot(discovery: boolean): Promise<DevicesSnapshot> {
  const status = await deviceRequest<Snapshot>({ action: discovery ? 'discover' : 'status' })
  const owners: DevicesSnapshot['owners'] = {}
  for (const item of [...status.leases, ...status.queue]) {
    const session = sessionOf(item.owner)
    if (session !== undefined && sessionExists(session)) owners[item.owner] = { session, title: sessionTitle(readSession(session)) }
  }
  const fingerprint = JSON.stringify([status.devices, status.leases, status.queue, status.events])
  if (last !== undefined && last !== fingerprint) notifyChange({ type: 'devices' })
  last = fingerprint
  return { ...status, owners }
}
export const devicesApi = new Hono()
  .use('*', async (c, next) => { c.header('Cache-Control', 'no-store'); await next() })
  .onError((error, c) => c.json({ error: error.message }, 409))
  .get('/', async (c) => c.json(await snapshot(false)))
  .post('/discover', async (c) => c.json(await snapshot(true)))
  .post('/leases', async (c) => {
    const body = await c.req.json() as Record<string, unknown>
    const request = parseRequest({ ...body, action: 'acquire', owner: 'manual' })
    const result = await deviceRequest<LeaseResult>(request)
    notifyChange({ type: 'devices' })
    return c.json(result)
  })
  .post('/leases/:id/release', async (c) => {
    const status = await deviceRequest<Snapshot>({ action: 'status' })
    const lease = status.leases.find((item) => item.id === c.req.param('id'))
    if (!lease) return c.json({ error: '租约已结束' }, 404)
    await deviceRequest({ action: 'release', lease: lease.id, owner: lease.owner })
    notifyChange({ type: 'devices' })
    return c.json({ ok: true })
  })
  .post('/queue/cancel', async (c) => {
    await deviceRequest({ action: 'cancel', owner: 'manual' })
    notifyChange({ type: 'devices' })
    return c.json({ ok: true })
  })
  .post('/:id/control', async (c) => {
    const body = await c.req.json() as Record<string, unknown>
    await deviceRequest(parseRequest({ ...body, action: 'control', device: c.req.param('id') }))
    notifyChange({ type: 'devices' })
    return c.json({ ok: true })
  })
  .get('/:id/screenshot', async (c) => c.json(await deviceRequest<{ image: string; mime: string; at: number }>({ action: 'screenshot', device: c.req.param('id') })))
export type DevicesApi = typeof devicesApi

import { randomUUID } from 'node:crypto'
import type { Lease, Platform, State } from './types.js'

export const policy = { idle: 15 * 60_000, maxHold: 60 * 60_000, queueIdle: 3 * 60_000 }
export function event(state: State, text: string, now: number, device?: string, owner?: string) {
  state.events.push({ time: now, text, ...(device && { device }), ...(owner && { owner }) })
  state.events = state.events.slice(-200)
}
export function release(state: State, lease: Lease, now: number, why: string) {
  for (const id of lease.devices) {
    const device = state.devices.find((item) => item.id === id)!
    device.status = 'cleaning'
    delete device.error
  }
  state.leases = state.leases.filter((item) => item.id !== lease.id)
  event(state, why, now, undefined, lease.owner)
}

// 双端整组分配，单端请求不会各拿一台后再等待另一台。
export function schedule(state: State, now: number, busy: ReadonlySet<string> = new Set()) {
  state.queue = state.queue.filter((item) => {
    if (now - item.lastSeen <= policy.queueIdle) return true
    event(state, '排队超时，已取消', now, undefined, item.owner)
    return false
  })
  for (const lease of [...state.leases]) {
    if (busy.has(lease.id)) continue
    if ((!lease.claimed && now - lease.createdAt > policy.queueIdle) || now - lease.lastSeen > policy.idle || (state.queue.length > 0 && now - lease.createdAt > policy.maxHold)) {
      release(state, lease, now, '占用超时，正在清理设备')
    }
  }
  const blocked = new Set<Platform>()
  for (const waiting of [...state.queue]) {
    if (waiting.platforms.some((platform) => blocked.has(platform))) {
      waiting.platforms.forEach((platform) => blocked.add(platform))
      continue
    }
    const devices = waiting.platforms.map((platform) => state.devices.find((item) => item.platform === platform && item.status === 'free'))
    if (devices.some((device) => !device)) {
      waiting.platforms.forEach((platform) => blocked.add(platform))
      continue
    }
    const ids = devices.map((device) => device!.id)
    for (const device of devices) device!.status = 'reserved'
    state.leases.push({ ...waiting, id: randomUUID(), devices: ids, createdAt: now, lastSeen: now })
    state.queue = state.queue.filter((item) => item.owner !== waiting.owner)
    event(state, `已分配 ${ids.join('、')}`, now, undefined, waiting.owner)
  }
}
export function requestLease(state: State, owner: string, reason: string, platforms: Platform[], now: number) {
  const existing = state.leases.find((item) => item.owner === owner) ?? state.queue.find((item) => item.owner === owner)
  if (existing && [...existing.platforms].sort().join() !== [...platforms].sort().join()) throw new Error('已有不同平台的申请，请先释放或取消')
  if (existing) existing.lastSeen = now
  else {
    if (platforms.some((platform) => !state.devices.some((device) => device.platform === platform))) throw new Error('设备池缺少申请的平台，请先初始化受管理设备')
    state.queue.push({ owner, reason, platforms, createdAt: now, lastSeen: now })
    event(state, '申请设备', now, undefined, owner)
  }
}
export function requireLease(state: State, owner: string, id: string): Lease {
  const lease = state.leases.find((item) => item.id === id && item.owner === owner)
  if (!lease) throw new Error('设备租约已失效，请重新申请')
  return lease
}

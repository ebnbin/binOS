import { describe, expect, it } from 'vitest'
import { emptyState } from './types.js'
import { policy, release, requestLease, requireLease, schedule } from './state.js'

function pool() {
  const state = emptyState()
  state.devices = [
    { id: 'android', platform: 'android', name: 'Android', target: 'a', status: 'free' },
    { id: 'ios', platform: 'ios', name: 'iPhone', target: 'i', status: 'free' },
  ]
  return state
}
describe('设备租约', () => {
  it('双端原子申请，等待双端不会先占有一个平台；同一会话重试不重复分配', () => {
    const state = pool()
    requestLease(state, 'a', '', ['android'], 0)
    schedule(state, 0)
    requestLease(state, 'b', '', ['android', 'ios'], 1)
    requestLease(state, 'b', '', ['ios', 'android'], 2)
    schedule(state, 2)
    expect(state.queue).toHaveLength(1)
    expect(state.devices[1].status).toBe('free')
    requestLease(state, 'c', '', ['ios'], 3)
    schedule(state, 3)
    expect(state.leases.map((item) => item.owner)).toEqual(['a'])
    expect(state.queue.map((item) => item.owner)).toEqual(['b', 'c'])
  })
  it('释放后必须清理完成再分配；旧租约不能操作新分配的设备', () => {
    const state = pool()
    requestLease(state, 'a', '', ['android', 'ios'], 0)
    schedule(state, 0)
    const old = state.leases[0]
    release(state, old, 1, '释放')
    requestLease(state, 'b', '', ['android', 'ios'], 2)
    schedule(state, 2)
    expect(state.leases).toHaveLength(0)
    state.devices.forEach((device) => { device.status = 'free' })
    schedule(state, 3)
    expect(state.leases[0].owner).toBe('b')
    expect(() => requireLease(state, 'a', old.id)).toThrow('设备租约已失效')
  })
  it('命令执行期间不回收；空闲超时、排队失联和未领取的预留都会回收', () => {
    const state = pool()
    requestLease(state, 'a', '', ['android', 'ios'], 0)
    schedule(state, 0)
    state.leases[0].claimed = true
    const id = state.leases[0].id
    schedule(state, policy.idle + 1, new Set([id]))
    expect(state.leases).toHaveLength(1)
    schedule(state, policy.idle + 2)
    expect(state.leases).toHaveLength(0)
    state.devices.forEach((device) => { device.status = 'free' })
    requestLease(state, 'b', '', ['android', 'ios'], 0)
    schedule(state, 0)
    schedule(state, policy.queueIdle + 1)
    expect(state.leases).toHaveLength(0)
    requestLease(state, 'c', '', ['android'], 0)
    schedule(state, policy.queueIdle + 1)
    expect(state.queue).toHaveLength(0)
  })
  it('故障、维护和清理中的设备不分配；有人排队时最长占用限制生效', () => {
    const state = pool()
    state.devices[0].status = 'maintenance'
    requestLease(state, 'a', '', ['android'], 0)
    schedule(state, 0)
    expect(state.leases).toHaveLength(0)
    state.devices[0].status = 'broken'
    schedule(state, 1)
    expect(state.leases).toHaveLength(0)
    state.devices[0].status = 'free'
    schedule(state, 2)
    state.leases[0].claimed = true
    state.leases[0].lastSeen = policy.maxHold
    requestLease(state, 'b', '', ['android'], policy.maxHold)
    schedule(state, policy.maxHold + 3)
    expect(state.devices[0].status).toBe('cleaning')
  })
})

import { existsSync, readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Device, LeaseResult } from './types.js'

const controls = vi.hoisted(() => ({ failCreate: '', failReset: false, failDestroy: false, gate: undefined as Promise<void> | undefined, destroyed: [] as string[] }))
vi.mock('./platform.js', async (original) => {
  const platform = await original<typeof import('./platform.js')>()
  return { ...platform,
    create: async (device: Device) => {
      await controls.gate
      if (device.platform === controls.failCreate) throw new Error('模拟创建失败')
      return { ...device, target: device.target || device.id }
    },
    destroy: async (device: Device) => { if (controls.failDestroy) throw new Error('模拟销毁失败'); controls.destroyed.push(device.id) },
    reset: async () => { if (controls.failReset) throw new Error('模拟清理失败') }, health: async () => {},
  }
})
const root = mkdtempSync(path.join(os.tmpdir(), 'binos-device-manager-'))
process.env.BINOS_ROOT = root
process.env.BINOS_TEST_INSTANCE = '1'
const { Manager } = await import('./manager.js')
const { statePath } = await import('./config.js')
const { policy } = await import('./state.js')
async function until(test: () => boolean) {
  for (let i = 0; i < 200; i++) { if (test()) return; await new Promise((resolve) => setTimeout(resolve, 10)) }
  throw new Error('等待状态超时')
}
async function acquire(manager: InstanceType<typeof Manager>, owner = 'a', platforms: ('android' | 'ios')[] = ['android', 'ios']) {
  await manager.handle({ action: 'acquire', owner, platforms, reason: '' })
  await until(() => manager.state.leases.some((l) => l.owner === owner))
  return (await manager.handle({ action: 'acquire', owner, platforms, reason: '' }) as LeaseResult).lease!
}
beforeEach(() => {
  rmSync(statePath, { force: true })
  controls.failCreate = ''; controls.failReset = false; controls.failDestroy = false; controls.gate = undefined; controls.destroyed = []
})
afterAll(() => rmSync(root, { recursive: true, force: true }))

describe('设备服务生命周期', () => {
  it('冷池整组分配，服务重建保留租约，归还后清理并复用原设备', async () => {
    const manager = new Manager()
    expect(manager.state.devices).toHaveLength(0)
    const lease = await acquire(manager)
    const restored = new Manager()
    expect(restored.state.leases[0].id).toBe(lease.id)
    await restored.handle({ action: 'release', owner: 'a', lease: lease.id })
    await until(() => restored.state.devices.every((d) => d.status === 'free'))
    const other = await acquire(restored, 'b')
    expect(other.devices.sort()).toEqual(lease.devices.sort())
    await expect(restored.handle({ action: 'renew', owner: 'a', lease: lease.id })).rejects.toThrow('已失效')
    await restored.handle({ action: 'release', owner: 'a', lease: lease.id })
    expect(restored.state.leases[0].id).toBe(other.id)
  })
  it('超时未领取后再次申请不会返回已失效的预留或重复交付', async () => {
    const manager = new Manager()
    const pending = await manager.handle({ action: 'acquire', owner: 'a', platforms: ['ios'], reason: '' }) as LeaseResult
    await until(() => manager.state.leases.length === 1)
    manager.state.leases[0].createdAt = Date.now() - policy.queueIdle - 1
    await expect(manager.handle({ action: 'acquire', owner: 'a', platforms: ['ios'], reason: '', requestId: pending.requestId })).rejects.toThrow('申请已结束')
    expect(manager.state.leases).toHaveLength(0)
    await until(() => manager.state.devices.every((d) => d.status === 'free'))
  })
  it('旧版登记簿迁移保留租约和设备归属', async () => {
    writeFileSync(statePath, JSON.stringify({ version: 1, mode: 'mock', devices: [{ id: 'ios-12345678', name: 'binos-ios-12345678', target: 'original', platform: 'ios', status: 'leased' }], leases: [{ id: 'lease', owner: 'a', platforms: ['ios'], devices: ['ios-12345678'], createdAt: Date.now(), lastSeen: Date.now(), claimed: true, reason: '' }], queue: [], events: [] }))
    const manager = new Manager()
    expect(manager.state.version).toBe(2)
    expect(manager.state.leases[0].id).toBe('lease')
    expect(manager.state.leases[0].requestId).toBeTruthy()
    expect(manager.state.devices[0].target).toBe('original')
  })
  it('创建中取消后，晚到的创建结果不能恢复租约或泄漏容量', async () => {
    let resume!: () => void
    controls.gate = new Promise<void>((resolve) => { resume = resolve })
    const manager = new Manager()
    const pending = await manager.handle({ action: 'acquire', owner: 'a', platforms: ['android', 'ios'], reason: '' }) as LeaseResult
    expect(pending.phase).toBe('preparing')
    await manager.handle({ action: 'cancel', owner: 'a', requestId: pending.requestId })
    resume()
    await until(() => manager.state.devices.length === 0)
    expect(manager.state.leases).toHaveLength(0)
    expect(controls.destroyed).toHaveLength(2)
    await expect(manager.handle({ action: 'acquire', owner: 'a', platforms: ['android', 'ios'], reason: '', requestId: pending.requestId })).rejects.toThrow('申请已结束')
  })
  it('双端一端失败整组报错，成功的一端回到闲置状态', async () => {
    controls.failCreate = 'ios'
    const manager = new Manager()
    await manager.handle({ action: 'acquire', owner: 'a', platforms: ['android', 'ios'], reason: '' })
    await until(() => manager.state.queue[0]?.phase === 'failed')
    expect(manager.state.leases).toHaveLength(0)
    expect(manager.state.devices.find((d) => d.platform === 'android')?.status).toBe('free')
    const result = await manager.handle({ action: 'acquire', owner: 'a', platforms: ['android', 'ios'], reason: '' }) as LeaseResult
    expect(result.error).toContain('创建失败')
  })
  it('销毁失败保留容量，有界重试，页面可以重新发起回收', async () => {
    const manager = new Manager()
    const lease = await acquire(manager, 'a', ['android'])
    controls.failDestroy = true
    await manager.handle({ action: 'control', device: lease.devices[0], operation: 'destroy' })
    await until(() => manager.state.devices[0].status === 'broken')
    for (let i = 0; i < 2; i++) {
      manager.state.devices[0].retryAt = 0
      manager.tick()
      await until(() => manager.state.devices[0].status === 'broken')
    }
    expect(manager.state.devices[0].attempts).toBe(3)
    manager.tick()
    expect(manager.state.devices).toHaveLength(1)
    controls.failDestroy = false
    await manager.handle({ action: 'control', device: lease.devices[0], operation: 'destroy' })
    await until(() => manager.state.devices.length === 0)
  })
  it('强制回收先撤销整组租约并终止命令，再销毁指定设备', async () => {
    const manager = new Manager()
    const lease = await acquire(manager)
    const marker = path.join(root, 'started')
    const running = manager.handle({ action: 'run', owner: 'a', lease: lease.id, command: [process.execPath, '-e', `require('fs').writeFileSync(${JSON.stringify(marker)},'1');setTimeout(()=>{},30000)`], cwd: root, timeout: 60000 }).then(() => 'success', (error: Error) => error.message)
    await until(() => existsSync(marker))
    await manager.handle({ action: 'control', device: lease.devices[0], operation: 'destroy' })
    expect(manager.state.leases).toHaveLength(0)
    await expect(manager.handle({ action: 'renew', owner: 'a', lease: lease.id })).rejects.toThrow('已失效')
    expect(await running).toContain('强制回收')
    await until(() => manager.state.devices.length === 1 && manager.state.devices[0].status === 'free')
  })
  it('重启继续销毁中间状态，闲置时间不会被重启延长', async () => {
    const manager = new Manager()
    const lease = await acquire(manager)
    await manager.handle({ action: 'release', owner: 'a', lease: lease.id })
    await until(() => manager.state.devices.every((d) => d.status === 'free'))
    const saved = JSON.parse(readFileSync(statePath, 'utf8'))
    saved.devices[0].status = 'destroying'
    saved.devices[1].idleSince = Date.now() - policy.deviceIdle - 1
    writeFileSync(statePath, JSON.stringify(saved))
    const restored = new Manager()
    restored.tick()
    await until(() => restored.state.devices.length === 0)
    expect(restored.state.devices).toHaveLength(0)
  })
})
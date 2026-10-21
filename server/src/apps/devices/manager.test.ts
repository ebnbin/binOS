import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'

const { failReset } = vi.hoisted(() => ({ failReset: { current: false } }))
vi.mock('./platform.js', async (original) => {
  const platform = await original<typeof import('./platform.js')>()
  return { ...platform, reset: async () => { if (failReset.current) throw new Error('模拟清理失败') }, health: async () => {} }
})
const root = mkdtempSync(path.join(os.tmpdir(), 'binos-device-manager-'))
process.env.BINOS_ROOT = root
process.env.BINOS_TEST_INSTANCE = '1'
const { Manager } = await import('./manager.js')
afterAll(() => rmSync(root, { recursive: true, force: true }))

describe('设备服务恢复和故障隔离', () => {
  it('服务重建后保留租约，失败的清理进入故障状态，手动恢复后才能分配', async () => {
    const manager = new Manager()
    await manager.handle({ action: 'acquire', owner: 'a', platforms: ['android', 'ios'], reason: '测试' })
    const old = manager.state.leases[0]
    const restored = new Manager()
    expect(restored.state.leases[0].id).toBe(old.id)
    failReset.current = true
    await restored.handle({ action: 'release', owner: 'a', lease: old.id })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(restored.state.devices.every((device) => device.status === 'broken')).toBe(true)
    await restored.handle({ action: 'acquire', owner: 'b', platforms: ['android', 'ios'], reason: '' })
    expect(restored.state.leases).toHaveLength(0)
    failReset.current = false
    for (const device of restored.state.devices) await restored.handle({ action: 'control', device: device.id, operation: 'restore' })
    await new Promise((resolve) => setTimeout(resolve, 20))
    restored.tick()
    expect(restored.state.leases[0].owner).toBe('b')
    await expect(restored.handle({ action: 'screenshot', device: 'android-preview', owner: 'a', lease: old.id })).rejects.toThrow('设备租约已失效')
  })
})

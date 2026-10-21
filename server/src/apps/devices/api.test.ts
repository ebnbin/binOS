import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import type { LeaseResult, Snapshot } from './types.js'

const root = mkdtempSync(path.join(os.tmpdir(), 'binos-devices-api-'))
process.env.BINOS_ROOT = root
process.env.BINOS_TEST_INSTANCE = '1'
const tsx = import.meta.resolve('tsx')
process.execArgv.push('--import', tsx)
const { api } = await import('../../api.js')
const { deviceRequest } = await import('./client.js')
const base = '/api/apps/devices'
const post = (url: string, data: unknown) => api.request(`${base}${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
afterAll(async () => {
  await new Promise((resolve) => setTimeout(resolve, 200))
  await deviceRequest({ action: 'stop' })
  rmSync(root, { recursive: true, force: true })
})
describe('Devices HTTP API', () => {
  it('真实挂载路径返回设备；网页不能执行命令、初始化或停止服务；手动申请不能伪造会话身份', async () => {
    const response = await api.request(base)
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(((await response.json()) as Snapshot).mode).toBe('mock')
    for (const endpoint of ['/run', '/provision', '/stop']) expect((await post(endpoint, {})).status).toBe(404)
    expect((await post('/leases', { platforms: ['ios', 'ios'], reason: '' })).status).toBe(409)
    const acquired = await post('/leases', { owner: 'another-thread', platforms: ['android', 'ios'], reason: '手动测试' })
    const lease = ((await acquired.json()) as LeaseResult).lease!
    expect(lease.owner).toBe('manual')
    const capture = await api.request(`${base}/ios-preview/screenshot`)
    expect(capture.status).toBe(200)
    expect(((await capture.json()) as { image: string }).image.length).toBeGreaterThan(0)
    expect((await post('/ios-preview/control', { operation: 'maintenance' })).status).toBe(409)
    expect((await post(`/leases/${lease.id}/release`, {})).status).toBe(200)
  }, 15_000)
})

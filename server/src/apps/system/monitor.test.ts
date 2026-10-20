import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import type { ChildProcess } from 'node:child_process'
import { afterAll, expect, it, vi } from 'vitest'
import type { Snapshot } from './types.js'
import { snapshot } from '../../../test-fixtures/system.js'

const { collect, spawnMock } = vi.hoisted(() => ({ collect: vi.fn<() => Promise<Snapshot>>(), spawnMock: vi.fn<(...args: unknown[]) => ChildProcess>() }))
vi.mock('node:child_process', () => ({ spawn: spawnMock }))
vi.mock('./collect.js', () => ({
  Collector: class {
    collect = collect
  },
}))
const root = mkdtempSync(path.join(os.tmpdir(), 'binos-monitor-'))
process.env.BINOS_ROOT = root
process.env.BINOS_TEST_INSTANCE = '1'
const { Monitor } = await import('./monitor.js')
const { systemApi } = await import('./api.js')
afterAll(() => rmSync(root, { recursive: true, force: true }))

it('合并并发采集，保存并恢复历史和阈值，采集失败不伪造正常快照', async () => {
  const monitor = new Monitor()
  const data = snapshot(Date.now())
  collect.mockImplementationOnce(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10))
    return data
  })
  await Promise.all([monitor.refresh(), monitor.refresh()])
  expect(collect).toHaveBeenCalledTimes(1)
  expect(monitor.history()).toHaveLength(1)
  expect(monitor.status().snapshot).toEqual(data)
  monitor.configure({ ...monitor.status().thresholds, cpu: 85 })
  const restored = new Monitor()
  expect(restored.status().thresholds.cpu).toBe(85)
  expect(restored.history()).toHaveLength(1)
  collect.mockRejectedValueOnce(new Error('timeout'))
  await monitor.refresh()
  expect(monitor.status().snapshot?.at).toBe(data.at)
  expect(monitor.status().collectionError).toContain('timeout')
  collect.mockResolvedValueOnce({ ...data, at: data.at + 5000 })
  await monitor.refresh()
  expect(monitor.status().collectionError).toBeUndefined()
})
it('监控间断与宿主重启留下已恢复事件，不能让未知内存压力消除现有异常', async () => {
  const monitor = new Monitor()
  const data = snapshot(Date.now())
  data.memory.pressure = 'critical'
  collect.mockResolvedValueOnce(data)
  await monitor.refresh()
  const next = structuredClone(data)
  next.at += 20_000
  collect.mockResolvedValueOnce(next)
  await monitor.refresh()
  expect(monitor.status().alerts.find((a) => a.key === 'memory' && !a.resolved)).toBeDefined()
  next.at += 5000
  next.memory.pressure = 'unknown'
  collect.mockResolvedValueOnce(structuredClone(next))
  await monitor.refresh()
  expect(monitor.status().alerts.find((a) => a.key === 'memory' && !a.resolved)).toBeDefined()
  next.at += 180_000
  next.host.boot += 180_000
  next.memory.pressure = 'normal'
  collect.mockResolvedValueOnce(next)
  await monitor.refresh()
  expect(monitor.status().alerts.find((a) => a.key === 'gap')?.resolved).toBe(next.at)
  expect(monitor.status().alerts.find((a) => a.key === 'boot')?.resolved).toBe(next.at)
  expect(monitor.status().alerts.find((a) => a.key === 'memory')?.resolved).toBe(next.at)
})
it('只允许固定日志名，读取有界尾部，诊断响应不缓存', async () => {
  const logs = path.join(root, 'Library/binos/logs')
  mkdirSync(logs, { recursive: true })
  writeFileSync(path.join(logs, 'server.log'), 'old-line\n'.repeat(10_000) + 'latest\n')
  const response = await systemApi.request('/logs/server')
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  const log = (await response.json()) as { text: string; truncated: boolean }
  expect(log.truncated).toBe(true)
  expect(log.text.endsWith('latest\n')).toBe(true)
  expect(Buffer.byteLength(log.text)).toBeLessThanOrEqual(65536)
  expect((await systemApi.request('/logs/unknown')).status).toBe(404)
  expect((await systemApi.request('/report')).headers.get('Content-Disposition')).toContain('attachment')
  const stored = JSON.parse(readFileSync(path.join(root, 'Library/Apps/system/monitor.json'), 'utf8'))
  expect(stored.thresholds.cpu).toBe(85)
})
it('唤醒操作拒绝任意时长，阈值接口拒绝不合法输入', async () => {
  const post = (url: string, body: unknown, method = 'POST') =>
    systemApi.request(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  expect((await post('/awake', { hours: -1 })).status).toBe(400)
  expect((await post('/awake', { hours: '8' })).status).toBe(400)
  expect((await post('/awake', { hours: 0 })).status).toBe(200)
  expect((await post('/thresholds', { cpu: 999 }, 'PUT')).status).toBe(400)
})

it('临时唤醒绑定当前后端并设定期限，可停止且退出时清理状态', async () => {
  const monitor = new Monitor()
  const child = Object.assign(new EventEmitter(), { kill: vi.fn<() => boolean>(() => true), unref: vi.fn<() => void>() })
  spawnMock.mockReturnValueOnce(child as unknown as ChildProcess)
  const starting = monitor.keepAwake(8)
  child.emit('spawn')
  await starting
  expect(spawnMock).toHaveBeenCalledWith('/usr/bin/caffeinate', ['-i', '-t', '28800', '-w', String(process.pid)], { stdio: 'ignore' })
  expect(monitor.status().keepAwakeUntil).toBeGreaterThan(Date.now())
  child.emit('exit', 0)
  expect(monitor.status().keepAwakeUntil).toBeNull()
  spawnMock.mockReturnValueOnce(child as unknown as ChildProcess)
  const again = monitor.keepAwake(1)
  child.emit('spawn')
  await again
  await monitor.keepAwake(0)
  expect(child.kill).toHaveBeenCalledOnce()
  expect(monitor.status().keepAwakeUntil).toBeNull()
})
it('损坏的告警记录不会阻止新采集，保留恢复事件', async () => {
  writeFileSync(
    path.join(root, 'Library/Apps/system/monitor.json'),
    JSON.stringify({ thresholds: { cpu: 90, cpuSeconds: 60, diskFreeGB: 20, diskFreePercent: 10, battery: 20 }, alerts: {}, samples: [] }),
  )
  const monitor = new Monitor()
  expect(monitor.status().storageError).toContain('记录格式无效')
  collect.mockResolvedValueOnce(snapshot(Date.now()))
  await monitor.refresh()
  expect(monitor.status().snapshot).not.toBeNull()
  expect(monitor.status().alerts.some((a) => a.key === 'storage-recovery')).toBe(true)
})

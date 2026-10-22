import { createServer } from 'node:net'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, expect, it } from 'vitest'

const root = mkdtempSync(path.join(os.tmpdir(), 'binos-device-upgrade-'))
process.env.BINOS_ROOT = root
process.env.BINOS_TEST_INSTANCE = '1'
const tsx = import.meta.resolve('tsx')
process.execArgv.push('--import', tsx)
const { socketPath, dataDir, statePath } = await import('./config.js')
const { mkdirSync } = await import('node:fs')
const { deviceRequest, adminDeviceRequest } = await import('./client.js')
import type { Snapshot } from './types.js'
let pid: number | undefined
let oldStopped = false
const legacy = createServer((socket) => {
  socket.once('data', (bytes) => {
    const request = JSON.parse(bytes.toString())
    if (request.action === 'stop') {
      oldStopped = true
      socket.end(JSON.stringify({ ok: true, result: { ok: true } }) + '\n')
      legacy.close()
    } else socket.end(JSON.stringify({ ok: true, result: { version: 1, mode: 'mock', build: 'legacy' } }) + '\n')
  })
})
afterAll(async () => {
  if (pid) await adminDeviceRequest({ action: 'stop' }).catch(() => process.kill(pid!, 'SIGTERM'))
  legacy.close()
  if (existsSync(socketPath)) rmSync(socketPath)
  rmSync(root, { recursive: true, force: true })
})
it('升级没有管理 socket 的旧服务，迁移空池并等待新协议就绪', async () => {
  mkdirSync(dataDir, { recursive: true })
  writeFileSync(statePath, JSON.stringify({ version: 1, mode: 'mock', devices: [], leases: [], queue: [], events: [] }))
  await new Promise<void>((resolve) => legacy.listen(socketPath, resolve))
  const status = await deviceRequest<Snapshot>({ action: 'status' })
  pid = status.pid
  expect(oldStopped).toBe(true)
  expect(status.version).toBe(2)
  expect(status.devices).toHaveLength(0)
  expect(status.capacity).toBe(4)
})

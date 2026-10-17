import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { StateEntry } from './types.js'

const root = mkdtempSync(path.join(os.tmpdir(), 'binos-test-'))
process.env.BINOS_ROOT = root
process.env.BINOS_TEST_INSTANCE = '1'
const { api } = await import('./api.js')
const { onChange } = await import('./events.js')
const { statePath } = await import('./paths.js')

const read = async () => (await (await api.request('/api/state')).json()) as { version: number; entries: StateEntry[] }
const write = (changes: unknown, contentType = 'application/json') =>
  api.request('/api/state', { method: 'POST', body: JSON.stringify({ changes }), headers: { 'Content-Type': contentType } })

describe('系统状态', () => {
  it('一组改动共用一个版本号，删除也让版本号递增，并推送给所有订阅者', async () => {
    const events: unknown[] = []
    const off = onChange((event) => events.push(event))
    expect(await (await write([{ key: 'shell/windows/1', value: { app: 'agent' } }, { key: 'a', value: 1 }])).json()).toEqual({ version: 1 })
    expect(await (await write([{ key: 'a', value: null }])).json()).toEqual({ version: 2 })
    off()
    expect(await read()).toEqual({ version: 2, entries: [{ key: 'shell/windows/1', value: { app: 'agent' }, version: 1 }] })
    expect(events).toEqual([
      { type: 'state', version: 1, changes: [{ key: 'shell/windows/1', value: { app: 'agent' } }, { key: 'a', value: 1 }] },
      { type: 'state', version: 2, changes: [{ key: 'a', value: null }] },
    ])
  })

  it('写入文件失败时，状态保持原样', async () => {
    const before = await read()
    // 临时文件的位置被目录占住，写入时就会失败
    mkdirSync(`${statePath}.tmp`)
    await write([{ key: 'b', value: 1 }])
    rmSync(`${statePath}.tmp`, { recursive: true })
    expect(await read()).toEqual(before)
  })

  it('后端重启后从文件恢复', async () => {
    const before = await read()
    vi.resetModules()
    const { readState } = await import('./state.js')
    expect(readState()).toEqual(before)
  })

  it('拒绝不合规的改动', async () => {
    for (const changes of [
      [],
      [{ key: 'Shell/x', value: 1 }],
      [{ key: '../x', value: 1 }],
      [{ key: 'a//b', value: 1 }],
      [{ key: 'a' }],
      [{ key: 'a', value: 'x'.repeat(64 * 1024) }],
    ]) {
      expect((await write(changes)).status).toBe(400)
    }
    expect((await write([{ key: 'a', value: 1 }], 'text/plain')).status).toBe(415)
  })
})

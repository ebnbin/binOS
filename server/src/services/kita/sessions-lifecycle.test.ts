import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, it, vi } from 'vitest'

const root = mkdtempSync(path.join(os.tmpdir(), 'kita-lifecycle-'))
process.env.BINOS_ROOT = root
process.env.BINOS_TEST_INSTANCE = '1'
const { startSessions } = await import('./sessions.js')

it('重复启动只有一个轮询，旧清理函数不影响新轮询，停止后可以删除数据目录', () => {
  vi.useFakeTimers()
  const stopFirst = startSessions()
  const stopSecond = startSessions()
  try {
    expect(vi.getTimerCount()).toBe(1)
    stopFirst()
    expect(vi.getTimerCount()).toBe(1)
    stopSecond()
    expect(vi.getTimerCount()).toBe(0)
    rmSync(root, { recursive: true, force: true })
    expect(() => vi.advanceTimersByTime(1000)).not.toThrow()
  } finally {
    stopFirst()
    stopSecond()
    vi.useRealTimers()
  }
})

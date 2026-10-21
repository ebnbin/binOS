import { mkdtempSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = mkdtempSync(path.join(os.tmpdir(), 'binos-test-'))
process.env.BINOS_ROOT = root
const { allLimits, saveLimits } = await import('./limits.js')

const window = (id: string, minutes: number, utilization: number) => ({ id, minutes, utilization, resetsAt: 1 })

describe('saveLimits', () => {
  it('只报了变了的窗口时按 id 并进之前的，窗口按长短排', () => {
    saveLimits('codex', { limited: false, windows: [window('10080', 10080, 0.5), window('300', 300, 0.1)], updatedAt: 'a' })
    saveLimits('codex', { limited: true, windows: [window('300', 300, 0.9)], updatedAt: 'b' })
    expect(allLimits().codex).toEqual({ limited: true, windows: [window('300', 300, 0.9), window('10080', 10080, 0.5)], updatedAt: 'b' })
  })
})

import { appendFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = mkdtempSync(path.join(os.tmpdir(), 'binos-test-'))
process.env.BINOS_ROOT = root
const { encodeEntries } = await import('./journal.js')
const { readEvents, appendEntries, createKitaSession, readEntries, sessionDir, sessionInfo } = await import('./store.js')
const time = () => new Date().toISOString()
const input = (text: string, mode: 'start' | 'steer' = 'start') => ({ type: 'input' as const, time: time(), mode, text })
const turnEnd = () => ({ type: 'turn_end' as const, time: time(), durationMs: 0 })
const newThread = () => createKitaSession({ type: 'session', time: time(), agent: 'claude', owner: 'test', cwd: root })

describe('store', () => {
  it('summary.json 和 events.jsonl 对不上时从头重算；一轮进行中的 input 是插话，不算新的一轮', () => {
    const id = newThread()
    expect(appendEntries(id, [input('一'), input('插话', 'steer'), turnEnd(), input('二')])).toBe(1)
    expect(sessionInfo(id)).toMatchObject({ count: 5, turns: 2, inTurn: true, owner: 'test' })
    rmSync(path.join(sessionDir(id), 'summary.json'))
    appendFileSync(path.join(sessionDir(id), 'events.jsonl'), JSON.stringify({ events: encodeEntries([turnEnd()], readEvents(id).at(-1)) }) + '\n')
    expect(sessionInfo(id)).toMatchObject({ count: 6, turns: 2, inTurn: false })
  })

  it('换了 agent 那边的会话时，之前累计的用量另记，按 API 价格折算每一轮的花费', () => {
    const id = newThread()
    const tokens = { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 }
    appendEntries(id, [
      { type: 'agent_session', time: time(), id: 'a' },
      { ...turnEnd(), usage: { opus: tokens } },
      { type: 'agent_session', time: time(), id: 'b' },
      { ...turnEnd(), usage: { opus: tokens } },
    ])
    const info = sessionInfo(id)
    expect(info.usageBefore).toEqual({ opus: tokens })
    expect(info.usageLatest).toEqual({ opus: tokens })
    expect(info.costs.map(([, cost]) => cost)).toEqual([4, 4])
  })

  it('跳过崩溃时没写完的半行，之后的条目另起一行', () => {
    const id = newThread()
    appendFileSync(path.join(sessionDir(id), 'events.jsonl'), '{"type":"in')
    expect(appendEntries(id, [input('二')])).toBe(1)
    expect(readEntries(id).map((item) => item.type)).toEqual(['session', 'input'])
    expect(readFileSync(path.join(sessionDir(id), 'events.jsonl'), 'utf8').split('\n')).toHaveLength(3)
  })
})

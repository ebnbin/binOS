import { describe, expect, it } from 'vitest'
import { encodeEntries, projectItems, projectTurns } from './journal.js'
import type { Entry } from './types.js'

const time = new Date().toISOString()
describe('Kita events', () => {
  it('工具开始、结果聚合为同一个 Item；插话沿用 Turn，下一轮有新的身份', () => {
    const entries: Entry[] = [
      { type: 'input', time, mode: 'start', text: 'start' },
      { type: 'tool_call', time, id: 'tool-a', name: 'shell', tool: { kind: 'command', command: 'pwd' } },
      { type: 'input', time, mode: 'steer', text: 'steer' },
      { type: 'tool_result', time, callId: 'tool-a', status: 'done', output: '/tmp' },
      { type: 'turn_end', time, durationMs: 1 },
      { type: 'input', time, mode: 'start', text: 'next' },
      { type: 'tool_call', time, id: 'tool-a', name: 'shell', tool: { kind: 'command', command: 'pwd' } },
    ]
    const first = encodeEntries(entries.slice(0, 3), undefined)
    const events = [...first, ...encodeEntries(entries.slice(3), first.at(-1))]
    expect(new Set(events.map((event) => event.id)).size).toBe(7)
    expect(events.map((event) => event.seq)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(events[0].turnId).toBe(events[4].turnId)
    expect(events[5].turnId).not.toBe(events[0].turnId)
    const tools = projectItems(events).filter((item) => item.kind === 'tool')
    expect(tools).toHaveLength(2)
    expect(tools[0].entries.map((entry) => entry.type)).toEqual(['tool_call', 'tool_result'])
    expect(projectTurns(events)).toEqual([
      expect.objectContaining({ id: events[0].turnId, finishedAt: time }),
      { id: events[5].turnId, startedAt: time },
    ])
  })
})

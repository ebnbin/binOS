import { mkdtempSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { CodexOutput } from './codex-output.js'
import type { TranscriptRecord } from './types.js'

const threadId = 'th1'
const notify = (method: string, params: object) => JSON.stringify({ method, params: { threadId, turnId: 'tu1', ...params } })
const item = (event: 'started' | 'completed', fields: object) => notify(`item/${event}`, { item: fields })
const command = (status: string, extra = {}) => ({ type: 'commandExecution', id: 'c1', command: "/bin/zsh -lc 'echo '\\''hi'\\'''", status, ...extra })

// 按行喂给解析器，offset 用行号代替
function run(lines: string[], recorded = 0) {
  const filesDir = mkdtempSync(path.join(os.tmpdir(), 'binos-test-'))
  const output = new CodexOutput({ filesDir, recorded, sessionId: undefined })
  const records: TranscriptRecord[] = []
  lines.forEach((line, index) => records.push(...output.push(line, index + 1).records))
  return { output, records }
}

const turn = [
  JSON.stringify({ id: 2, result: { thread: { id: threadId }, model: 'gpt-6.1-sol' } }),
  notify('turn/started', { turn: { id: 'tu1', status: 'inProgress', error: null } }),
  item('started', { type: 'reasoning', id: 'r1', summary: [] }),
  notify('item/reasoning/summaryTextDelta', { itemId: 'r1', delta: '想', summaryIndex: 0 }),
  item('completed', { type: 'reasoning', id: 'r1', summary: ['想一想'] }),
  item('started', command('inProgress')),
  // 子 agent 的会话不算
  JSON.stringify({ method: 'item/started', params: { threadId: 'other', item: command('inProgress', { id: 'c2' }) } }),
  item('completed', command('completed', { aggregatedOutput: "'hi'\n", exitCode: 0 })),
  item('started', { type: 'fileChange', id: 'f1', status: 'inProgress', changes: [
    { path: '/a', kind: { type: 'add' }, diff: 'x\n' },
    { path: '/b', kind: { type: 'update', move_path: null }, diff: '@@\n-a\n+b\n' },
  ] }),
  item('completed', { type: 'fileChange', id: 'f1', status: 'completed', changes: [] }),
  notify('item/agentMessage/delta', { itemId: 'm1', delta: '好' }),
  item('completed', { type: 'agentMessage', id: 'm1', text: '好了' }),
  notify('thread/tokenUsage/updated', {
    tokenUsage: {
      total: { totalTokens: 120, inputTokens: 100, cachedInputTokens: 60, cacheWriteInputTokens: 0, outputTokens: 20 },
      last: { totalTokens: 120, inputTokens: 100, cachedInputTokens: 60, cacheWriteInputTokens: 0, outputTokens: 20 },
      modelContextWindow: 1000,
    },
  }),
  notify('turn/completed', { turn: { id: 'tu1', status: 'completed', error: null } }),
]

describe('CodexOutput', () => {
  it('命令按 Bash 记，改的每个文件各记一次 Patch，别的会话的条目不记', () => {
    const { records, output } = run(turn)
    expect(records.map((record) => record.type)).toEqual([
      'agent',
      'thinking',
      'tool_use',
      'tool_result',
      'tool_use',
      'tool_use',
      'tool_result',
      'tool_result',
      'text',
    ])
    expect(records[0]).toMatchObject({ provider: 'codex', sessionId: threadId })
    expect(records[1]).toMatchObject({ text: '想一想' })
    expect(records[2]).toMatchObject({ id: 'c1', name: 'Bash', input: { command: "echo 'hi'" } })
    expect(records[3]).toMatchObject({ toolUseId: 'c1', status: 'done', output: "'hi'" })
    expect(records[5]).toMatchObject({ id: 'f1:1', name: 'Patch', input: { file_path: '/b', kind: 'update' } })
    expect(records[8]).toMatchObject({ text: '好了' })
    expect(output.answered).toBe(true)
    expect(output.current()).toMatchObject({ text: '', thinking: '' })
    expect(output.finish({ startedAt: '2026-01-01T00:00:00.000Z', stopped: false, errors: '' }).at(-1)).toMatchObject({
      type: 'result',
      model: 'gpt-6.1-sol',
      outputTokens: 20,
      context: { tokens: 120, window: 1000 },
      sessionUsage: { 'gpt-6.1-sol': { input: 40, output: 20, cacheRead: 60, cacheWrite: 0 } },
    })
  })

  it('后端重启后重读，已经记下的不再记，状态照样恢复', () => {
    const { records, output } = run(turn, 6)
    expect(records.map((record) => record.type)).toEqual(['tool_result', 'tool_use', 'tool_use', 'tool_result', 'tool_result', 'text'])
    expect(output.answered).toBe(true)
  })

  it('没答完就结束时，没有结果的调用记成出错；最后一轮失败时记下原因', () => {
    const { output } = run([
      ...turn.slice(0, 6),
      notify('turn/completed', { turn: { id: 'tu1', status: 'failed', error: { message: '额度用完了' } } }),
    ])
    expect(output.finish({ startedAt: '2026-01-01T00:00:00.000Z', stopped: false, errors: '' }).slice(-2)).toMatchObject([
      { type: 'tool_result', toolUseId: 'c1', status: 'error' },
      { type: 'result', outcome: 'error', error: '额度用完了' },
    ])
  })
})

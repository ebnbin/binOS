import { mkdtempSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { DecodedItem } from '../types.js'
import { CodexDecoder } from './decoder.js'

const threadId = 'th1'
const notify = (method: string, params: object) => JSON.stringify({ method, params: { threadId, turnId: 'tu1', ...params } })
const item = (event: 'started' | 'completed', fields: object) => notify(`item/${event}`, { item: fields })
const command = (status: string, extra = {}) => ({ type: 'commandExecution', id: 'c1', command: "/bin/zsh -lc 'echo '\\''hi'\\'''", status, ...extra })

// 按行喂给解码器，offset 用行号代替
function run(lines: string[]) {
  const filesDir = mkdtempSync(path.join(os.tmpdir(), 'binos-test-'))
  const decoder = new CodexDecoder({ filesDir, agentSession: undefined })
  const items: DecodedItem[] = []
  lines.forEach((line, index) => items.push(...decoder.push(line, index + 1).items))
  return { decoder, items }
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

describe('CodexDecoder', () => {
  it('命令、改的每个文件各记一次工具调用，别的会话的条目不记', () => {
    const { items, decoder } = run(turn)
    expect(items.map((item) => item.type)).toEqual([
      'agent_session',
      'thinking',
      'tool_call',
      'tool_result',
      'tool_call',
      'tool_call',
      'tool_result',
      'tool_result',
      'text',
    ])
    expect(items[0]).toMatchObject({ id: threadId })
    expect(items[1]).toMatchObject({ text: '想一想' })
    expect(items[2]).toMatchObject({ id: 'c1', tool: { kind: 'command', command: "echo 'hi'" } })
    expect(items[3]).toMatchObject({ callId: 'c1', status: 'done', output: "'hi'" })
    expect(items[5]).toMatchObject({ id: 'f1:1', tool: { kind: 'edit', path: '/b', change: { type: 'diff', op: 'update' } } })
    expect(items[8]).toMatchObject({ text: '好了' })
    expect(decoder.answered).toBe(true)
    expect(decoder.current()).toMatchObject({ text: '', thinking: '' })
    expect(decoder.endTurn({ startedAt: '2026-01-01T00:00:00.000Z', stopped: false }).at(-1)).toMatchObject({
      type: 'turn_end',
      model: 'gpt-6.1-sol',
      outputTokens: 20,
      context: { tokens: 120, window: 1000 },
      usage: { 'gpt-6.1-sol': { input: 40, output: 20, cacheRead: 60, cacheWrite: 0 } },
    })
  })

  it('没答完就结束时，没有结果的调用记成出错；最后一轮失败时记下原因', () => {
    const { decoder } = run([
      ...turn.slice(0, 6),
      notify('turn/completed', { turn: { id: 'tu1', status: 'failed', error: { message: '额度用完了' } } }),
    ])
    expect(decoder.endTurn({ startedAt: '2026-01-01T00:00:00.000Z', stopped: false }).slice(-2)).toMatchObject([
      { type: 'tool_result', callId: 'c1', status: 'error' },
      { type: 'turn_end', outcome: 'error', error: '额度用完了' },
    ])
  })
})

describe('登录无效', () => {
  it('第一条 401 的出错通知就报告', () => {
    const filesDir = mkdtempSync(path.join(os.tmpdir(), 'binos-test-'))
    const output = new CodexDecoder({ filesDir, agentSession: undefined })
    output.push(turn[0], 1)
    const error = notify('error', {
      error: { message: 'Reconnecting... 2/5', codexErrorInfo: { responseStreamDisconnected: { httpStatusCode: null } }, additionalDetails: 'workspace routing discovery unauthorized (401)' },
      willRetry: true,
    })
    expect(output.push(error, 2).authFailed).toBe(true)
    expect(output.push(notify('error', { error: { message: 'Reconnecting... 1/5', additionalDetails: 'stream disconnected' }, willRetry: true }), 3).authFailed).toBeUndefined()
  })
})

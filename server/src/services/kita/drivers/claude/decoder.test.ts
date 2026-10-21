import { mkdtempSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { DecodedItem } from '../types.js'
import { ClaudeDecoder } from './decoder.js'

const time = '2026-01-01T00:00:00.000Z'
const assistant = (content: unknown[], extra = {}) => JSON.stringify({ type: 'assistant', timestamp: time, message: { content }, ...extra })
const user = (content: unknown[], extra = {}) => JSON.stringify({ type: 'user', timestamp: time, message: { content }, ...extra })
const system = (fields: object) => JSON.stringify({ type: 'system', timestamp: time, ...fields })
const textDelta = (text: string) => JSON.stringify({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text } } })

it('重放工具图片时不覆盖已有快照', () => {
  const filesDir = mkdtempSync(path.join(os.tmpdir(), 'binos-image-replay-'))
  const decode = (text: string) => new ClaudeDecoder({ filesDir, agentSession: undefined }).push(user([
    { type: 'tool_result', tool_use_id: 'shot', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: Buffer.from(text).toString('base64') } }] },
  ]), 1).items
  expect(decode('original-image').at(-1)).toMatchObject({ images: ['shot-0.png'] })
  expect(decode('different-image').at(-1)).toMatchObject({ images: ['shot-0.png'] })
  expect(readFileSync(path.join(filesDir, 'shot-0.png'), 'utf8')).toBe('original-image')
})

// 按行喂给解码器，offset 用行号代替
function run(lines: string[], session?: string) {
  const filesDir = mkdtempSync(path.join(os.tmpdir(), 'binos-test-'))
  const decoder = new ClaudeDecoder({ filesDir, agentSession: session })
  const items: DecodedItem[] = []
  lines.forEach((line, index) => items.push(...decoder.push(line, index + 1).items))
  return { decoder, items, filesDir }
}

const output = [
  assistant([{ type: 'text', text: '先看看' }], { session_id: 's1' }),
  assistant([{ type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'npm run dev', run_in_background: true } }]),
  user([{ type: 'tool_result', tool_use_id: 't1', content: 'started' }]),
  assistant([{ type: 'tool_use', id: 't2', name: 'Agent', input: { prompt: '查一下' } }]),
  assistant([{ type: 'tool_use', id: 't3', name: 'Read', input: { file_path: '/a' } }], { parent_tool_use_id: 't2' }),
  system({ subtype: 'task_notification', tool_use_id: 't1', status: 'completed' }),
]

describe('ClaudeDecoder', () => {
  it('后台工具的结果等任务结束时才记，子 agent 的条目带着 parent，工具按类别记下', () => {
    const { items } = run(output)
    expect(items.map((item) => [item.type, 'offset' in item && item.offset])).toEqual([
      ['agent_session', 1],
      ['text', 1],
      ['tool_call', 2],
      ['tool_call', 4],
      ['tool_call', 5],
      ['tool_result', 6],
    ])
    expect(items[2]).toMatchObject({ name: 'Bash', tool: { kind: 'command', command: 'npm run dev' }, background: true })
    expect(items[2]).not.toHaveProperty('input')
    expect(items[3]).toMatchObject({ tool: { kind: 'subagent', prompt: '查一下' } })
    expect(items[4]).toMatchObject({ id: 't3', parent: 't2', tool: { kind: 'read', path: '/a' } })
    expect(items[5]).toMatchObject({ callId: 't1', status: 'done', output: 'started' })
  })

  it('子 agent 的进展在它交回结果后清掉', () => {
    const { decoder: parsed } = run([
      output[3],
      system({ subtype: 'task_progress', tool_use_id: 't2', description: 'Reading a', usage: { tool_uses: 1, total_tokens: 900 } }),
    ])
    expect(parsed.current().tasks).toEqual({ t2: { activity: 'Reading a', toolUses: 1, tokens: 900 } })
    const { events } = parsed.push(user([{ type: 'tool_result', tool_use_id: 't2', content: '查到了' }]), 9)
    expect(events).toEqual([{ type: 'task', callId: 't2', progress: null }])
    expect(parsed.current().tasks).toEqual({})
  })

  it('被打断时没写完的文字在 result 时记下；之后插的话让它接着答', () => {
    const { decoder: parsed } = run([textDelta('写到一')])
    const { items } = parsed.push(JSON.stringify({ type: 'result', is_error: true }), 2)
    expect(items).toMatchObject([{ type: 'text', text: '写到一', offset: 2 }])
    expect(parsed.answered).toBe(true)
    parsed.push(textDelta('hi'), 3)
    expect(parsed.answered).toBe(false)
    expect(parsed.current().text).toBe('hi')
  })

  it('一轮结束时补记没写完的文字，没有结果的工具调用记成出错', () => {
    const { decoder } = run([...output.slice(0, 5), textDelta('写到一'), textDelta('半')])
    const items = decoder.endTurn({ startedAt: time, stopped: true })
    expect(items.map((item) => item.type)).toEqual(['text', 'tool_result', 'tool_result', 'tool_result', 'turn_end'])
    expect(items[0]).toMatchObject({ text: '写到一半' })
    expect(items.slice(1, 4)).toMatchObject([
      { callId: 't1', status: 'error', output: 'started' },
      { callId: 't2', status: 'error' },
      { callId: 't3', status: 'error', parent: 't2' },
    ])
    expect(items[4]).toMatchObject({ outcome: 'stopped' })
    expect(items[4]).not.toHaveProperty('error')
  })

  it('没有 result 时记成出错；一轮的统计只算这一轮的', () => {
    const { decoder } = run([])
    expect(decoder.endTurn({ startedAt: time, stopped: false, error: 'boom' }).at(-1)).toMatchObject({ outcome: 'error', error: 'boom' })
    const usage = { output_tokens: 5 }
    decoder.push(assistant([{ type: 'text', text: '一' }], { message: { id: 'm1', content: [], usage } }), 1)
    decoder.push(JSON.stringify({ type: 'result' }), 2)
    expect(decoder.endTurn({ startedAt: time, stopped: false }).at(-1)).toMatchObject({ outputTokens: 5 })
    decoder.push(JSON.stringify({ type: 'result' }), 3)
    const end = decoder.endTurn({ startedAt: time, stopped: false }).at(-1)
    expect(end).not.toHaveProperty('outputTokens')
    expect(end).not.toHaveProperty('error')
  })

  it('工具结果里的图片存成文件，文字只留末尾', () => {
    const data = Buffer.from('png-bytes')
    const { items, filesDir } = run([
      user([
        {
          type: 'tool_result',
          tool_use_id: 't9',
          content: [
            { type: 'text', text: 'x'.repeat(70 * 1024) + '结尾' },
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: data.toString('base64') } },
          ],
        },
      ]),
    ])
    const result = items[0] as Extract<DecodedItem, { type: 'tool_result' }>
    expect(result.truncated).toBe(true)
    expect(result.output?.length).toBe(64 * 1024)
    expect(result.output?.endsWith('结尾')).toBe(true)
    expect(result.images).toEqual(['t9-1.png'])
    expect(readFileSync(path.join(filesDir, 't9-1.png'))).toEqual(data)
  })

  it('额度快用完的提醒不算限流，rejected 才算', () => {
    const { decoder } = run([])
    const limits = (status: string) =>
      decoder.push(JSON.stringify({ type: 'rate_limit_event', rate_limit_info: { status, unifiedWindows: { seven_day: { utilization: 0.76, resetsAt: 1 } } } }), 1).limits
    expect(limits('allowed_warning')).toMatchObject({ limited: false, windows: [{ id: 'seven_day', minutes: 10080, utilization: 0.76 }] })
    expect(limits('rejected')).toMatchObject({ limited: true })
  })
})

import { mkdtempSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ClaudeOutput } from './claude-output.js'
import type { TranscriptRecord } from './types.js'

const time = '2026-01-01T00:00:00.000Z'
const assistant = (content: unknown[], extra = {}) => JSON.stringify({ type: 'assistant', timestamp: time, message: { content }, ...extra })
const user = (content: unknown[], extra = {}) => JSON.stringify({ type: 'user', timestamp: time, message: { content }, ...extra })
const system = (fields: object) => JSON.stringify({ type: 'system', timestamp: time, ...fields })
const textDelta = (text: string) => JSON.stringify({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text } } })

// 按行喂给解析器，offset 用行号代替
function run(lines: string[], recorded = 0, sessionId?: string) {
  const filesDir = mkdtempSync(path.join(os.tmpdir(), 'binos-test-'))
  const output = new ClaudeOutput({ filesDir, recorded, sessionId })
  const records: TranscriptRecord[] = []
  lines.forEach((line, index) => records.push(...output.push(line, index + 1).records))
  return { output, records, filesDir }
}

const output = [
  assistant([{ type: 'text', text: '先看看' }], { session_id: 's1' }),
  assistant([{ type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'npm run dev', run_in_background: true } }]),
  user([{ type: 'tool_result', tool_use_id: 't1', content: 'started' }]),
  assistant([{ type: 'tool_use', id: 't2', name: 'Agent', input: { prompt: '查一下' } }]),
  assistant([{ type: 'tool_use', id: 't3', name: 'Read', input: { file_path: '/a' } }], { parent_tool_use_id: 't2' }),
  system({ subtype: 'task_notification', tool_use_id: 't1', status: 'completed' }),
]

describe('ClaudeOutput', () => {
  it('后台工具的结果等任务结束时才记，子 agent 的记录带着 parent', () => {
    const { records } = run(output)
    expect(records.map((record) => [record.type, 'offset' in record && record.offset])).toEqual([
      ['agent', 1],
      ['text', 1],
      ['tool_use', 2],
      ['tool_use', 4],
      ['tool_use', 5],
      ['tool_result', 6],
    ])
    expect(records[4]).toMatchObject({ id: 't3', parent: 't2' })
    expect(records[5]).toMatchObject({ toolUseId: 't1', status: 'done', output: 'started' })
  })

  it('重读时已经记下的行只恢复状态，不再产生记录', () => {
    const { records } = run(output, 3, 's1')
    expect(records.map((record) => record.type === 'tool_use' ? record.id : record.type)).toEqual(['t2', 't3', 'tool_result'])
    expect(records.at(-1)).toMatchObject({ toolUseId: 't1', output: 'started' })
  })

  it('结束时补记没写完的文字，没有结果的工具调用记成出错', () => {
    const { output: parsed } = run([...output.slice(0, 5), textDelta('写到一'), textDelta('半')])
    const records = parsed.finish({ startedAt: time, stopped: true, errors: '' })
    expect(records.map((record) => record.type)).toEqual(['text', 'tool_result', 'tool_result', 'tool_result', 'result'])
    expect(records[0]).toMatchObject({ text: '写到一半' })
    expect(records.slice(1, 4)).toMatchObject([
      { toolUseId: 't1', status: 'error', output: 'started' },
      { toolUseId: 't2', status: 'error' },
      { toolUseId: 't3', status: 'error', parent: 't2' },
    ])
    expect(records[4]).toMatchObject({ outcome: 'stopped' })
    expect(records[4]).not.toHaveProperty('error')
  })

  it('没有 result 时记成出错，带上错误输出', () => {
    const { output: parsed } = run([])
    expect(parsed.finish({ startedAt: time, stopped: false, errors: 'boom' }).at(-1)).toMatchObject({ outcome: 'error', error: 'boom' })
  })

  it('工具结果里的图片存成文件，文字只留末尾', () => {
    const data = Buffer.from('png-bytes')
    const { records, filesDir } = run([
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
    const result = records[0] as Extract<TranscriptRecord, { type: 'tool_result' }>
    expect(result.truncated).toBe(true)
    expect(result.output?.length).toBe(64 * 1024)
    expect(result.output?.endsWith('结尾')).toBe(true)
    expect(result.images).toEqual(['t9-1.png'])
    expect(readFileSync(path.join(filesDir, 't9-1.png'))).toEqual(data)
  })
})

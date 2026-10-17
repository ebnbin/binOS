import { describe, expect, it } from 'vitest'
import { ClaudeOutput } from './claude-output.js'

const line = (data: unknown) => JSON.stringify(data)
const textDelta = (text: string) => line({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text } } })

function setup() {
  const saved = new Map<string, Buffer>()
  const output = new ClaudeOutput((name, data) => saved.set(name, data))
  return { output, saved }
}

describe('ClaudeOutput', () => {
  it('逐字的文字在完整消息到达前作为进展显示', () => {
    const { output } = setup()
    expect(output.push(textDelta('你'))).toBe(true)
    expect(output.push(textDelta('好'))).toBe(true)
    expect(output.progress()).toEqual([{ type: 'text', text: '你好' }])

    output.push(line({ type: 'assistant', message: { content: [{ type: 'text', text: '你好' }] } }))
    expect(output.partial).toBe('')
    expect(output.entries).toEqual([
      { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: '你好' }] } },
    ])
    expect(output.progress()).toEqual([{ type: 'text', text: '你好' }])
  })

  it('工具调用开始时先显示名称，结果按工具调用对应', () => {
    const { output } = setup()
    output.push(line({ type: 'stream_event', event: { type: 'content_block_start', content_block: { type: 'tool_use', id: 't1', name: 'Bash' } } }))
    expect(output.progress()).toEqual([{ type: 'tool_use', id: 't1', name: 'Bash', input: {} }])

    output.push(line({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'ls' } }] } }))
    output.push(line({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't1', content: 'a\nb', is_error: false }] } }))
    expect(output.progress()).toEqual([
      { type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'ls' } },
      { type: 'tool_result', tool_use_id: 't1', content: [{ type: 'text', text: 'a\nb' }], is_error: false },
    ])
  })

  it('工具结果里的图片存成文件，其他类型只记下类型', () => {
    const { output, saved } = setup()
    const data = Buffer.from('png-bytes')
    output.push(
      line({
        type: 'user',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 't2',
              content: [
                { type: 'text', text: '截图' },
                { type: 'image', source: { type: 'base64', media_type: 'image/png', data: data.toString('base64') } },
                { type: 'document', source: {} },
              ],
            },
          ],
        },
      }),
    )
    expect(output.entries[0].message!.content).toEqual([
      {
        type: 'tool_result',
        tool_use_id: 't2',
        content: [
          { type: 'text', text: '截图' },
          { type: 'image', file: 't2-1.png' },
          { type: 'text', text: '[document]' },
        ],
        is_error: undefined,
      },
    ])
    expect(saved.get('t2-1.png')).toEqual(data)
  })

  it('忽略子任务的输出和无法解析的行，记下 result', () => {
    const { output } = setup()
    expect(output.push(line({ type: 'assistant', parent_tool_use_id: 't4', message: { content: [{ type: 'text', text: '子任务' }] } }))).toBe(false)
    expect(output.push('{not json')).toBe(false)
    expect(output.push(line({ type: 'result', is_error: false, result: '完成' }))).toBe(false)
    expect(output.entries).toEqual([])
    expect(output.result).toMatchObject({ is_error: false, result: '完成' })
  })
})

import { mkdtempSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { AgentOutput } from './output.js'
import type { AgentRecord } from './types.js'

const root = mkdtempSync(path.join(os.tmpdir(), 'binos-test-'))
process.env.BINOS_ROOT = root
const { adapters } = await import('./adapters.js')
const { emptyLive } = await import('./output.js')
const { startRun } = await import('./runs.js')

// 假的 agent：收到一句话就原样输出一行，标准输入结束就退出
const script = path.join(root, 'fake-agent.mjs')
writeFileSync(
  script,
  `import { createInterface } from 'node:readline'
createInterface({ input: process.stdin }).on('line', (line) => {
  const message = JSON.parse(line)
  if (message.type === 'user') console.log(JSON.stringify({ echo: message.message.content }))
})`,
)

class EchoOutput implements AgentOutput {
  answered = false
  backgroundTasks = () => 0
  current = emptyLive
  push(text: string, offset: number) {
    this.answered = true
    return { records: [{ type: 'text' as const, time: new Date().toISOString(), text: JSON.parse(text).echo, offset }], events: [] }
  }
  finish = () => [{ type: 'result' as const, time: new Date().toISOString(), durationMs: 0 }]
}

// 通用的运行流程只经过适配层，换成假的 agent 照样跑
adapters.claude = { ...adapters.claude, command: () => [process.execPath, script], output: () => new EchoOutput() }

describe('startRun', () => {
  it('交出第一句话，回答期间能插话，答完一阵没人插话就让 agent 退出', async () => {
    const records: AgentRecord[] = []
    let finished = false
    const run = startRun('test', '1', { provider: 'claude', cwd: root, filesDir: root }, '你好', {
      records: (items) => records.push(...items),
      event: () => {},
      finished: () => (finished = true),
    })
    expect(run).toBeDefined()
    expect(await run!.send('再说一句')).toBe(true)
    await run!.finished
    expect(finished).toBe(true)
    expect(run!.open).toBe(false)
    expect(records.map((record) => (record.type === 'text' ? record.text : record.type))).toEqual(['你好', '再说一句', 'result'])
    expect(await run!.send('太晚了')).toBe(false)
  }, 10_000)
})

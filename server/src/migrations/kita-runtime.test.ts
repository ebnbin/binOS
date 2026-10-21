import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, expect, it } from 'vitest'

const root = mkdtempSync(path.join(os.tmpdir(), 'binos-kita-live-'))
process.env.BINOS_ROOT = root
process.env.BINOS_TEST_INSTANCE = '1'
process.execArgv.push('--import', import.meta.resolve('tsx'))
const { startHost, attachHost } = await import('../services/kita/host/client.js')
const { workerDir } = await import('../services/kita/store.js')
const { migrateAgentToKita } = await import('./kita.js')
const { drivers } = await import('../services/kita/drivers/index.js')
const { getKitaSession, startSessions } = await import('../services/kita/sessions.js')
const old = path.join(root, 'Library/Services/agent/threads/a')
mkdirSync(old, { recursive: true })
const time = new Date().toISOString()
const initial = [
  { type: 'thread', time, agent: 'claude', owner: 'test', cwd: root },
  { type: 'input', time, mode: 'start', text: 'before' },
]
writeFileSync(path.join(old, 'items.jsonl'), initial.map((entry) => JSON.stringify(entry) + '\n').join(''))
const script = path.join(root, 'agent.mjs')
writeFileSync(script, `import { createInterface } from 'node:readline'
createInterface({ input: process.stdin }).on('line', async line => {
  const m = JSON.parse(line)
  if (m.type !== 'user') return
  await new Promise(r => setTimeout(r, 400))
  console.log(JSON.stringify({ type:'assistant', session_id:'vendor-a', message:{content:[{type:'text',text:m.message.content}]} }))
  console.log(JSON.stringify({ type:'result', session_id:'vendor-a', is_error:false }))
})`)
const host = startHost(path.join(old, 'host'), { agent: 'claude', args: [process.execPath, script], cwd: root, env: process.env, stamp: 'test', itemsFrom: 2 })!
drivers.claude = { ...drivers.claude, host: () => ({ agent: 'claude', args: [process.execPath, script] }), authEnv: undefined }
afterAll(() => {
  attachHost(workerDir('a'))?.kill()
  rmSync(root, { recursive: true, force: true })
})

it('原路径的 host 继续执行，迁移后读完输出且重接不重复，下一轮可以继续', async () => {
  expect((await host.send({ type: 'message', text: 'before' })).ok).toBe(true)
  migrateAgentToKita(root)
  startSessions()
  const session = getKitaSession('a')!
  const waitTurn = async (n: number) => {
    for (let i = 0; i < 100; i++) {
      if (session.entries().filter((entry) => entry.type === 'turn_end').length >= n) return
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    throw new Error('迁移后的回答未结束')
  }
  await waitTurn(1)
  expect(session.entries().filter((entry) => entry.type === 'text')).toEqual([expect.objectContaining({ text: 'before' })])
  expect(session.summary().state).toBe('idle')
  expect(session.metadata().id).toBe('a')
  expect(getKitaSession('a', 'another-app')).toBeUndefined()
  startSessions()
  expect(session.entries().filter((entry) => entry.type === 'text')).toHaveLength(1)
  expect(await session.send({ text: 'after' })).toBe(true)
  await waitTurn(2)
  expect(session.turns()).toHaveLength(2)
  expect(session.entries().filter((entry) => entry.type === 'text').map((entry) => entry.text)).toEqual(['before', 'after'])
  const code = readFileSync(path.join(old, 'items.jsonl'), 'utf8')
  expect(code).toContain('"type":"thread"')
}, 15_000)

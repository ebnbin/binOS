import { spawn } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'

const root = mkdtempSync(path.join(os.tmpdir(), 'binos-test-'))
process.env.BINOS_ROOT = root
process.env.BINOS_TEST_INSTANCE = '1'
// host 进程运行的是 .ts
const tsx = import.meta.resolve('tsx')
process.execArgv.push('--import', tsx)

// 假的 agent：收到一句话先原样输出，再输出答完；以「慢」开头的话过一会儿才答完
const agentScript = path.join(root, 'fake-agent.mjs')
writeFileSync(
  agentScript,
  `import { createInterface } from 'node:readline'
createInterface({ input: process.stdin }).on('line', async (line) => {
  const message = JSON.parse(line)
  if (message.type !== 'user') return
  console.log(JSON.stringify({ text: message.message.content }))
  if (message.message.content.startsWith('慢')) await new Promise((resolve) => setTimeout(resolve, 800))
  console.log(JSON.stringify({ done: true }))
})`,
)

// 通用的流程只经过驱动，换成假的 agent 和与之对应的解码器照样跑。后端重启的测试里另一个进程也用它
const setupScript = path.join(root, 'setup.mts')
writeFileSync(
  setupScript,
  `import { drivers } from ${JSON.stringify(path.join(import.meta.dirname, 'drivers/index.ts'))}
const time = () => new Date().toISOString()
class FakeDecoder {
  answered = false
  backgroundTasks = () => 0
  current = () => ({ thinking: '', text: '', status: null, tasks: {} })
  push(text, offset) {
    const line = JSON.parse(text)
    this.answered = Boolean(line.done)
    return { items: line.done ? [] : [{ type: 'text', time: time(), text: line.text, offset }], events: [] }
  }
  endTurn({ stopped }) {
    this.answered = false
    return [{ type: 'turn_end', time: time(), durationMs: 0, ...(stopped && { outcome: 'stopped' }) }]
  }
}
drivers.claude = {
  ...drivers.claude,
  host: () => ({ agent: 'claude', args: [process.execPath, ${JSON.stringify(agentScript)}] }),
  decoder: () => new FakeDecoder(),
  authEnv: undefined,
}
`,
)
await import(setupScript)
const { createKitaSession, getKitaSession, startSessions } = await import('./sessions.js')
const { hostDir, sessionsDir } = await import('./store.js')
let stopPolling = startSessions()

// 测试留下的 agent 进程都结束掉
afterAll(() => {
  stopPolling()
  for (const id of readdirSync(sessionsDir)) {
    try {
      process.kill(-hostPid({ id } as KitaSession), 'SIGTERM')
    } catch {
      // 已经结束了
    }
  }
})

type KitaSession = NonNullable<ReturnType<typeof getKitaSession>>

const hostPid = (session: KitaSession) => (JSON.parse(readFileSync(path.join(hostDir(session.id), 'state.json'), 'utf8')) as { process: { pid: number } }).process.pid

// 等这个 session 的第 n 个 turn_end
async function turnEnded(session: KitaSession, n: number) {
  for (let i = 0; i < 100; i++) {
    if (session.entries().filter((item) => item.type === 'turn_end').length >= n) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('这一轮没有结束')
}

const summarize = (session: KitaSession) =>
  session.entries().map((item) => (item.type === 'text' ? item.text : item.type === 'input' ? `${item.mode}:${item.text}` : item.type))

describe('session', () => {
  it('答完一阵没人插话这一轮就结束，下一轮接着用同一个 agent 进程；回答中途能插话', async () => {
    const session = createKitaSession({ agent: 'claude', owner: 'test', cwd: root })
    expect(await session.send({ text: '慢一点说' })).toBe(true)
    expect(session.state()).toBe('running')
    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(await session.send({ text: '插一句' })).toBe(true)
    await turnEnded(session, 1)
    expect(session.state()).toBe('idle')
    const pid = hostPid(session)
    expect(await session.send({ text: '第二轮' })).toBe(true)
    await turnEnded(session, 2)
    expect(hostPid(session)).toBe(pid)
    expect(summarize(session)).toEqual(['session', 'start:慢一点说', '慢一点说', 'steer:插一句', '插一句', 'turn_end', 'start:第二轮', '第二轮', 'turn_end'])
  }, 15_000)

  it('停下时结束 agent 进程，这一轮记成停止；换了思考程度就换一个进程', async () => {
    const session = createKitaSession({ agent: 'claude', owner: 'test', cwd: root })
    await session.send({ text: '慢慢说' })
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(session.stop()).toBe(true)
    await turnEnded(session, 1)
    expect(session.entries().at(-1)).toMatchObject({ type: 'turn_end', outcome: 'stopped' })
    await session.send({ text: '再来' })
    await turnEnded(session, 2)
    const pid = hostPid(session)
    await session.send({ text: '换个思考程度' }, { effort: 'high' })
    await turnEnded(session, 3)
    expect(hostPid(session)).not.toBe(pid)
  }, 15_000)

  it('后端重启后接上还在运行的 agent 进程，已经记下的不重复记，接着说话', async () => {
    // 先在另一个进程里（重启前的后端）说一轮，然后它退出，host 留着
    const previous = path.join(root, 'previous.mts')
    writeFileSync(
      previous,
      `await import(${JSON.stringify(setupScript)})
const { createKitaSession, startSessions } = await import(${JSON.stringify(path.join(import.meta.dirname, 'sessions.ts'))})
startSessions()
const session = createKitaSession({ agent: 'claude', owner: 'test', cwd: ${JSON.stringify(root)} })
await session.send({ text: '重启前' })
while (!session.entries().some((item) => item.type === 'turn_end')) await new Promise((resolve) => setTimeout(resolve, 100))
console.log(session.id)
process.exit(0)
`,
    )
    const id = await new Promise<string>((resolve, reject) => {
      const child = spawn(process.execPath, ['--import', tsx, previous], { env: process.env, stdio: ['ignore', 'pipe', 'inherit'] })
      let output = ''
      child.stdout.on('data', (chunk: Buffer) => (output += chunk))
      child.on('exit', (code) => (code === 0 ? resolve(output.trim()) : reject(new Error(`退出码 ${code}`))))
    })
    stopPolling = startSessions()
    const session = getKitaSession(id)!
    const pid = hostPid(session)
    await new Promise((resolve) => setTimeout(resolve, 500))
    expect(summarize(session)).toEqual(['session', 'start:重启前', '重启前', 'turn_end'])
    await session.send({ text: '重启后' })
    await turnEnded(session, 2)
    expect(hostPid(session)).toBe(pid)
    expect(summarize(session)).toEqual(['session', 'start:重启前', '重启前', 'turn_end', 'start:重启后', '重启后', 'turn_end'])
  }, 20_000)
})

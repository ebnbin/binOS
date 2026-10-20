import { execFileSync } from 'node:child_process'
import { closeSync, constants, existsSync, openSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { open } from 'node:fs/promises'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { libraryDir } from '../../paths.js'
import { isRunning } from '../../process.js'
import type { ProcessIdentity } from '../../process.js'
import type { AgentProcess } from './agent-process.js'
import type { HostCommand, HostReply } from './host/protocol.js'
import { readItems } from './store.js'

// 换成 thread 之前的运行：一轮一个 agent 进程，消息经命名管道和一个转发进程（cat）交给它，输入关上它就退出。
// 换上 thread 的那次上线时正在进行的一轮（迁移时在它的 state.json 里记上了 thread）由这里接着跟完，之后就不再有了
const runsDir = path.join(libraryDir, 'agent', 'runs')

type RunState = { agent: ProcessIdentity; thread?: string }

// thread 里还没跟完的旧运行；没有时返回 undefined
export function legacyRun(threadId: string): AgentProcess | undefined {
  if (!existsSync(runsDir)) {
    return undefined
  }
  for (const id of readdirSync(runsDir)) {
    const dir = path.join(runsDir, id)
    let state: RunState
    try {
      state = JSON.parse(readFileSync(path.join(dir, 'state.json'), 'utf8'))
    } catch {
      continue
    }
    if (state.thread === threadId) {
      // 这一轮的条目从最后一个 turn_end 之后开始
      const itemsFrom = readItems(threadId).findLastIndex((item) => item.type === 'turn_end') + 1
      return new LegacyRun(dir, state, itemsFrom)
    }
  }
  return undefined
}

class LegacyRun implements AgentProcess {
  readonly output: string
  readonly errors: string
  readonly itemsFrom: number
  readonly stamp = undefined
  readonly commandable = true
  private readonly dir: string
  private readonly state: RunState
  private readonly input: string
  private readonly relay: string
  // 同时写的两条消息可能交错，按顺序一条条写
  private writing: Promise<void> = Promise.resolve()

  constructor(dir: string, state: RunState, itemsFrom: number) {
    this.dir = dir
    this.state = state
    this.itemsFrom = itemsFrom
    this.output = path.join(dir, 'output.jsonl')
    this.errors = path.join(dir, 'errors.log')
    this.input = path.join(dir, 'input.fifo')
    this.relay = path.join(dir, 'relay.pid')
  }

  running() {
    return isRunning(this.state.agent)
  }

  async send(command: HostCommand): Promise<HostReply> {
    try {
      switch (command.type) {
        case 'message':
          await this.writeLine({ type: 'user', message: { role: 'user', content: command.text } })
          break
        case 'interrupt':
          await this.writeLine({ type: 'control_request', request_id: crypto.randomUUID(), request: { subtype: 'interrupt' } })
          break
        // 结束转发进程，agent 处理完已经交过去的消息就退出
        case 'close':
          await this.writing.catch(() => {})
          this.stopRelay()
          break
      }
      return { ok: true }
    } catch (error) {
      return { ok: false, error: String(error) }
    }
  }

  kill() {
    try {
      process.kill(-this.state.agent.pid, 'SIGTERM')
    } catch {
      // 已经结束了
    }
  }

  dispose() {
    this.stopRelay()
    rmSync(this.dir, { recursive: true, force: true })
  }

  private writeLine(message: object): Promise<void> {
    const line = JSON.stringify(message) + '\n'
    const next = this.writing
      .catch(() => {})
      .then(async () => {
        // 先用非阻塞方式确认转发进程还在读，否则打开会一直卡住
        for (let attempt = 0; ; attempt++) {
          try {
            closeSync(openSync(this.input, constants.O_WRONLY | constants.O_NONBLOCK))
            break
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENXIO' || attempt >= 50) {
              throw new Error('没法给 agent 发消息', { cause: error })
            }
            await sleep(100)
          }
        }
        const handle = await open(this.input, 'a')
        try {
          await handle.write(line)
        } finally {
          await handle.close()
        }
      })
    this.writing = next
    return next
  }

  // 转发进程已经不在（或者进程号被别的程序用了）时什么都不做
  private stopRelay() {
    try {
      const pid = Number(readFileSync(this.relay, 'utf8'))
      if (execFileSync('ps', ['-o', 'args=', '-p', String(pid)], { encoding: 'utf8' }).trim() === 'cat') {
        process.kill(pid, 'SIGTERM')
      }
    } catch {
      // 已经结束了
    }
  }
}

import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { closeSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { createConnection } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { isRunning, processStartTime } from '../../../process.js'
import type { ProcessIdentity } from '../../../process.js'
import { hostProtocol } from './protocol.js'
import type { HostAgent, HostCommand, HostLaunch, HostReply } from './protocol.js'

// host 目录里的 state.json：host 进程是哪个、按哪个版本的约定、socket 在哪、启动时定下的东西和 thread 当时有几条
type HostState = { process: ProcessIdentity; protocol: number; socket: string; stamp: string; itemsFrom: number }

// host 进程的入口和这个模块在一起，开发时是 .ts
const mainPath = path.join(import.meta.dirname, `main${path.extname(import.meta.filename)}`)

// 连上 socket 前 host 可能还没开始监听；codex 打断时要等这一轮停下，回执可能要等一会儿
const connectTimeout = 5_000
const replyTimeout = 60_000

const files = (dir: string) => ({
  state: path.join(dir, 'state.json'),
  launch: path.join(dir, 'launch.json'),
  output: path.join(dir, 'output.jsonl'),
  errors: path.join(dir, 'errors.log'),
})

// unix socket 的路径有长度限制（macOS 上 104 字节），放在临时目录里，按 host 目录取名
const socketPath = (dir: string) => path.join(os.tmpdir(), `binos-${createHash('sha256').update(dir).digest('hex').slice(0, 16)}.sock`)

// 在 dir 里启动一个 host，让它在 cwd 里运行 agent；启动失败时返回 undefined
export function startHost(
  dir: string,
  options: { agent: HostAgent; args: unknown; cwd: string; env: NodeJS.ProcessEnv; stamp: string; itemsFrom: number },
): Host | undefined {
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const paths = files(dir)
  const launch: HostLaunch = { agent: options.agent, args: options.args, socket: socketPath(dir), output: paths.output, errors: paths.errors }
  writeFileSync(paths.launch, JSON.stringify(launch) + '\n')
  writeFileSync(paths.output, '')
  const errors = openSync(paths.errors, 'a')
  let pid: number | undefined
  try {
    // 自成一个进程组：后端重启时 launchd 结束的是后端所在的进程组，host 和 agent 不受影响。
    // 开发时后端由 tsx 运行，带上同样的参数，host 才能直接运行 .ts
    const child = spawn(process.execPath, [...process.execArgv, mainPath, paths.launch], {
      cwd: options.cwd,
      env: options.env,
      stdio: ['ignore', 'ignore', errors],
      detached: true,
    })
    child.on('error', () => {})
    child.unref()
    pid = child.pid
  } finally {
    closeSync(errors)
  }
  const startedAt = pid && processStartTime(pid)
  if (!pid || !startedAt) {
    rmSync(dir, { recursive: true, force: true })
    return undefined
  }
  const state: HostState = { process: { pid, startedAt }, protocol: hostProtocol, socket: launch.socket, stamp: options.stamp, itemsFrom: options.itemsFrom }
  writeFileSync(`${paths.state}.tmp`, JSON.stringify(state) + '\n')
  renameSync(`${paths.state}.tmp`, paths.state)
  return new Host(dir, state)
}

// 后端重启后接上 dir 里的 host；没有 host 时返回 undefined
export function attachHost(dir: string): Host | undefined {
  try {
    return new Host(dir, JSON.parse(readFileSync(files(dir).state, 'utf8')) as HostState)
  } catch {
    return undefined
  }
}

// 一个 host 进程：agent 的输出一行行写在 output 文件里，错误信息在 errors 文件里。
// itemsFrom：它启动时 thread 已经有几条，之后带 offset 的条目都出自它的输出。
// stamp：启动时就定下的东西（模型、思考程度、agent 版本、AGENTS.md……），变了要换一个；undefined 表示不能接着用，这一轮结束就让它退出。
// commandable：能接着发命令；false 时只跟着读完它的输出
export class Host {
  readonly output: string
  readonly errors: string
  readonly itemsFrom: number
  readonly stamp: string | undefined
  readonly commandable: boolean
  private readonly dir: string
  private readonly state: HostState

  constructor(dir: string, state: HostState) {
    this.dir = dir
    this.state = state
    this.output = files(dir).output
    this.errors = files(dir).errors
    this.itemsFrom = state.itemsFrom
    // 约定不同的旧 host 不再发命令，这一轮答完就让它退出
    this.commandable = state.protocol === hostProtocol
    this.stamp = this.commandable ? state.stamp : undefined
  }

  running() {
    return isRunning(this.state.process)
  }

  async send(command: HostCommand): Promise<HostReply> {
    if (!this.commandable) {
      return { ok: false, error: 'agent 进程不再接收命令' }
    }
    const deadline = Date.now() + connectTimeout
    for (;;) {
      const reply = await request(this.state.socket, command)
      if (reply !== 'unreachable') {
        return reply
      }
      if (Date.now() > deadline || !this.running()) {
        return { ok: false, error: '连不上 agent 进程' }
      }
      await sleep(100)
    }
  }

  // 结束整个进程组，包括 agent 在后台启动的任务
  kill() {
    try {
      process.kill(-this.state.process.pid, 'SIGTERM')
    } catch {
      // 已经结束了
    }
  }

  // 进程已经结束，删掉它的文件
  dispose() {
    rmSync(this.dir, { recursive: true, force: true })
  }
}

// 一条命令一个连接：发一行命令，收一行回执。还没开始监听时返回 unreachable
function request(socket: string, command: HostCommand): Promise<HostReply | 'unreachable'> {
  return new Promise((resolve) => {
    const connection = createConnection(socket)
    let reply = ''
    let connected = false
    const timer = setTimeout(() => {
      connection.destroy()
      resolve({ ok: false, error: 'agent 进程没有回应' })
    }, replyTimeout)
    connection.setEncoding('utf8')
    connection.on('connect', () => {
      connected = true
      connection.write(JSON.stringify(command) + '\n')
    })
    connection.on('data', (chunk: string) => (reply += chunk))
    connection.on('close', () => {
      clearTimeout(timer)
      if (!connected) {
        resolve('unreachable')
        return
      }
      try {
        resolve(JSON.parse(reply) as HostReply)
      } catch {
        resolve({ ok: false, error: 'agent 进程没有回应' })
      }
    })
    connection.on('error', () => {})
  })
}

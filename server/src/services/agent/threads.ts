import { createHash } from 'node:crypto'
import { existsSync, readFileSync, realpathSync, rmSync, statSync } from 'node:fs'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { codeDir } from '../../paths.js'
import { LineReader } from '../../line-reader.js'
import { agentEnv, drivers, fitOptions } from './drivers/index.js'
import type { Decoder } from './drivers/types.js'
import { copyAttachments, promptWithAttachments, snapshotFiles, transcriptPrompt } from './files.js'
import { attachHost, startHost } from './host/client.js'
import type { Host } from './host/client.js'
import { saveLimits } from './limits.js'
import { addUsage, appendItems, createThread as createThreadDir, filesDir, hostDir, listThreads, readItems, threadExists, threadInfo } from './store.js'
import type { AgentId, Item, Live, ThreadEvent, ThreadState, ThreadSummary } from './types.js'

// thread：和 agent 的一段对话，由 agent 服务保存，任何 app 都能建。app 只管说话、停下、看内容，
// agent 进程什么时候启动、什么时候退出是服务自己的事：一轮开始时没有合适的进程就启动一个（接着 agent 那边的会话），
// 答完后留着它，接着说话不用重新启动；空闲久了让它退出

const pollInterval = 200
// 答完后这么久没人插话、也没有后台任务，这一轮就结束了
const settleDelay = 1500
// 一轮结束后 agent 进程留这么久
const idleTimeout = 10 * 60_000
// 让 agent 进程退出后等这么久，还没退出就结束它
const closeWait = 10_000

// owner：属于哪个 app；instructions：追加的系统提示
export type ThreadOptions = { agent: AgentId; owner: string; cwd: string; instructions?: string }
// attachments：本机的文件，会移进 thread 的 files/
export type ThreadInput = { text: string; attachments?: { path: string; name: string }[] }
// interrupt：回答中途先打断正在做的事；model、effort：开始新的一轮时用，回答中途沿用这一轮的
export type SendOptions = { interrupt?: boolean; model?: string; effort?: string }

// startedAt：这一轮开始的时间；stopped：被停止了；failure：因为这个原因被结束了，记成出错；settledSince：从什么时候起答完了、没有新的动静
type Turn = { startedAt: string; stopped?: true; failure?: string; settledSince?: number }

const emptyLive = { thinking: '', text: '', status: null, tasks: {} }

const threads = new Map<string, Thread>()
// 有 agent 进程或者在一轮里的，要定时看一看
const active = new Set<Thread>()
const ownerListeners = new Map<string, Set<(threadId: string, event: ThreadEvent) => void>>()

export class Thread {
  readonly id: string
  private host: Host | undefined
  private decoder: Decoder | undefined
  private reader: LineReader | undefined
  // 这个进程的输出里已经记成条目的最大 offset：后端重启后从头重读，不重复记
  private recorded = 0
  // 这个进程的输出里之前各轮结束时读到的位置：重读到这里就结束一轮
  private turnEnds = new Set<number>()
  // 读到的最后一行的结束位置
  private offset = 0
  private turn: Turn | undefined
  private liveFiles: Record<string, string> = {}
  private idleSince = Date.now()
  // 开始一轮、插话、让进程退出这些操作一个个来，其间不判断一轮是否结束
  private queue: Promise<unknown> = Promise.resolve()
  private busy = false
  private readonly listeners = new Set<(event: ThreadEvent) => void>()

  constructor(id: string) {
    this.id = id
  }

  private get agent(): AgentId {
    return threadInfo(this.id).agent
  }

  summary(): ThreadSummary {
    const info = threadInfo(this.id)
    return {
      id: this.id,
      agent: info.agent,
      createdAt: info.createdAt,
      updatedAt: info.updatedAt,
      state: this.state(),
      turns: info.turns,
      ...(info.outcome && { outcome: info.outcome }),
      ...(info.context && { context: info.context }),
      ...(info.repliedAt && { repliedAt: info.repliedAt }),
      ...(info.model && { model: info.model }),
      ...(info.effort && { effort: info.effort }),
      usage: Object.keys(info.usageBefore).length > 0 ? addUsage(info.usageBefore, info.usageLatest) : info.usageLatest,
      costs: info.costs,
    }
  }

  state(): ThreadState {
    if (!this.turn) {
      return 'idle'
    }
    return this.decoder?.current().status?.type === 'waiting' ? 'waiting' : 'running'
  }

  items(from = 0): Item[] {
    return readItems(this.id, from)
  }

  live(): Live | null {
    return this.turn ? { ...(this.decoder?.current() ?? emptyLive), files: this.liveFiles } : null
  }

  subscribe(listener: (event: ThreadEvent) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  // 没在回答时开始新的一轮；正在回答时交给 agent，它在下一次工具调用之间看到。交不过去时返回 false
  send(input: ThreadInput, options: SendOptions = {}): Promise<boolean> {
    return this.exclusive(() => (this.turn ? this.steer(input, Boolean(options.interrupt)) : this.start(input, options)))
  }

  // 停下这一轮：结束整个进程组，包括 agent 在后台启动的任务。没在回答时返回 false
  stop(): boolean {
    if (!this.turn) {
      return false
    }
    this.turn.stopped = true
    if (this.host) {
      this.host.kill()
    } else if (!this.busy) {
      this.endTurn({ stopped: true })
    }
    return true
  }

  private async start(input: ThreadInput, options: SendOptions): Promise<boolean> {
    const { model, effort } = fitOptions(this.agent, options)
    const attachments = copyAttachments(this.id, input.attachments ?? [])
    const time = new Date().toISOString()
    this.append([
      {
        type: 'input',
        time,
        mode: 'start',
        text: input.text,
        ...(attachments.length > 0 && { attachments }),
        ...(model && { model }),
        ...(effort && { effort }),
      },
    ])
    removeOriginals(input)
    this.turn = { startedAt: time }
    this.liveFiles = {}
    this.emit({ type: 'live', live: this.live() })
    active.add(this)
    if (!(await this.ensureHost(model, effort))) {
      this.endTurn({ stopped: false, error: 'agent 启动失败' })
      return true
    }
    const host = this.host!
    if (this.turn.stopped) {
      host.kill()
      return true
    }
    const reply = await host.send({ type: 'message', text: promptWithAttachments(this.id, this.agent, input.text, attachments) })
    if (!reply.ok) {
      this.fail(reply.error)
    }
    return true
  }

  private async steer(input: ThreadInput, interrupt: boolean): Promise<boolean> {
    const host = this.host
    if (!host?.commandable || !host.running()) {
      return false
    }
    const attachments = copyAttachments(this.id, input.attachments ?? [])
    if (interrupt && !(await host.send({ type: 'interrupt' })).ok) {
      return false
    }
    if (!(await host.send({ type: 'message', text: promptWithAttachments(this.id, this.agent, input.text, attachments) })).ok) {
      return false
    }
    this.append([
      {
        type: 'input',
        time: new Date().toISOString(),
        mode: interrupt ? 'interrupt' : 'steer',
        text: input.text,
        ...(attachments.length > 0 && { attachments }),
      },
    ])
    removeOriginals(input)
    if (this.turn) {
      this.turn.settledSince = undefined
    }
    return true
  }

  // 有能接着用的 host 就用它；启动时定下的东西变了就换一个。启动失败时返回 false
  private async ensureHost(model: string | undefined, effort: string | undefined): Promise<boolean> {
    const info = threadInfo(this.id)
    const driver = drivers[info.agent]
    const devicePrompt = `开发验证设备通过 "$BINOS_DEVICES_CLI" devices 使用。先 acquire --platform android|ios|both --reason 用途，返回租约 ID；用 run --lease ID -- 命令 执行，自动续租并注入 ANDROID_SERIAL、BINOS_IOS_UDID 和 BINOS_IOS_DEVICE_SET。iOS 命令必须带 xcrun simctl --set "$BINOS_IOS_DEVICE_SET"，不要使用 booted。用 screenshot 只截租约里的设备，验证后 release --lease ID。无受管理设备时请告知用户，不要接管已有模拟器或自行 provision。`
    const instructions = [transcriptPrompt, devicePrompt, info.instructions].filter(Boolean).join('\n\n')
    const env = { ...agentEnv(info.agent), ...driver.authEnv?.(), BINOS_THREAD_ID: this.id, BINOS_DEVICES_CLI: path.join(codeDir, 'bin/binos') }
    const stamp = launchStamp([model, effort, instructions, driver.authEnv?.()], [info.cwd, driver.configDir], driver.command)
    if (this.host?.running() && this.host.stamp === stamp) {
      return true
    }
    if (this.host) {
      await this.retire()
    }
    const { agent, args } = driver.host({ agentSession: info.agentSession, model, effort, instructions })
    const host = startHost(hostDir(this.id), { agent, args, cwd: info.cwd, env, stamp, itemsFrom: info.count })
    if (!host) {
      return false
    }
    this.attach(host, 0, new Set())
    return true
  }

  // 接上一个 host，从头读它的输出：offset 不超过 recorded 的只用来恢复状态
  attach(host: Host, recorded: number, turnEnds: Set<number>) {
    this.host = host
    this.reader = new LineReader(host.output)
    this.decoder = drivers[this.agent].decoder({ filesDir: filesDir(this.id), agentSession: threadInfo(this.id).agentSession })
    this.recorded = recorded
    this.turnEnds = turnEnds
    this.offset = 0
    this.idleSince = Date.now()
    active.add(this)
  }

  // 后端重启时这一轮还没结束
  resumeTurn(startedAt: string) {
    this.turn = { startedAt }
    active.add(this)
  }

  // 让 host 退出：agent 处理完已经交过去的就退出，等不到就结束它
  private async retire() {
    const host = this.host!
    if (host.running() && host.commandable) {
      await host.send({ type: 'close' })
      const deadline = Date.now() + closeWait
      while (host.running() && Date.now() < deadline) {
        await sleep(100)
      }
    }
    if (host.running()) {
      host.kill()
      await sleep(200)
    }
    this.readNew()
    this.release()
  }

  private release() {
    this.host?.dispose()
    this.host = undefined
    this.decoder = undefined
    this.reader = undefined
  }

  // 结束整个进程组；这一轮以 reason 出错结束
  private fail(reason: string) {
    if (this.turn && !this.turn.failure) {
      this.turn.failure = reason
    }
    this.host?.kill()
  }

  private readNew() {
    if (!this.reader || !this.decoder) {
      return
    }
    const decoder = this.decoder
    for (const line of this.reader.read()) {
      const { items, events, limits, authFailed } = decoder.push(line.text, line.end)
      this.offset = line.end
      if (line.end <= this.recorded) {
        if (this.turnEnds.has(line.end)) {
          decoder.endTurn({ startedAt: new Date().toISOString(), stopped: false })
        }
        continue
      }
      if (limits) {
        saveLimits(this.agent, limits)
      }
      if (authFailed) {
        this.fail(drivers[this.agent].authFailed?.() ?? '登录无效，请求被拒绝了')
      }
      // agent 自己接着说起话来（比如插的话刚好在一轮结束时才交过去）：算作新的一轮
      if (!this.turn && items.length > 0) {
        this.turn = { startedAt: new Date().toISOString() }
        this.emit({ type: 'live', live: this.live() })
      }
      if (items.length > 0) {
        this.append(items)
        // 正在写的文字成了条目，它引用的文件也跟着记下了
        if (!decoder.current().text) {
          this.liveFiles = {}
        }
      }
      for (const event of events) {
        this.emit(event)
        // 文字里刚写完一个本机文件的引用，马上存快照，页面随即就能显示
        if (event.type === 'text' && event.text.includes(')')) {
          for (const [reference, name] of Object.entries(snapshotFiles(decoder.current().text, filesDir(this.id), this.liveFiles))) {
            this.liveFiles[reference] = name
            this.emit({ type: 'file', path: reference, name })
          }
        }
      }
    }
  }

  // 回复的文字引用的本机文件存好快照，记在这条上
  private append(items: Item[]) {
    if (items.length === 0) {
      return
    }
    const withFiles = items.map((item) => {
      if (item.type !== 'text') {
        return item
      }
      const files = snapshotFiles(item.text, filesDir(this.id))
      return Object.keys(files).length > 0 ? { ...item, files } : item
    })
    const index = appendItems(this.id, withFiles)
    withFiles.forEach((item, i) => this.emit({ type: 'item', index: index + i, item }))
  }

  private endTurn(options: { stopped: boolean; error?: string }) {
    const turn = this.turn!
    const items = this.decoder
      ? this.decoder.endTurn({ startedAt: turn.startedAt, ...options })
      : [
          {
            type: 'turn_end' as const,
            time: new Date().toISOString(),
            durationMs: Math.max(Date.now() - Date.parse(turn.startedAt), 0),
            ...(options.stopped ? { outcome: 'stopped' as const } : { outcome: 'error' as const, error: options.error ?? 'agent 异常结束' }),
          },
        ]
    if (this.host) {
      this.turnEnds.add(this.offset)
    }
    this.turn = undefined
    this.append(items.map((item) => (item.type === 'turn_end' && this.host ? { ...item, offset: this.offset } : item)))
    this.liveFiles = {}
    this.idleSince = Date.now()
    this.emit({ type: 'live', live: null })
  }

  // 定时看一看：读新的输出，agent 进程退出了就收尾，答完一阵就结束这一轮，空闲久了让进程退出
  poll() {
    this.readNew()
    if (this.busy) {
      return
    }
    const host = this.host
    if (host && !host.running()) {
      this.readNew()
      if (this.turn) {
        const errors = existsSync(host.errors) ? readFileSync(host.errors, 'utf8').trim() : ''
        const answered = this.decoder?.answered && !this.turn.failure
        this.endTurn({ stopped: Boolean(this.turn.stopped) && !this.turn.failure, error: this.turn.failure ?? (answered ? undefined : errors || undefined) })
      }
      this.release()
    } else if (host && this.turn && this.decoder) {
      const turn = this.turn
      if (!this.decoder.answered || this.decoder.backgroundTasks() > 0 || turn.stopped || turn.failure) {
        turn.settledSince = undefined
      } else {
        turn.settledSince ??= Date.now()
        if (Date.now() - turn.settledSince >= settleDelay) {
          this.endTurn({ stopped: false })
        }
      }
    } else if (host && (host.stamp === undefined || Date.now() - this.idleSince >= idleTimeout)) {
      // 不能接着用的 host 这一轮结束就让它退出
      void this.exclusive(() => this.retire())
    } else if (!host && this.turn) {
      this.endTurn({ stopped: Boolean(this.turn.stopped), error: '回答被中断：agent 没能启动' })
    }
    if (!this.host && !this.turn) {
      active.delete(this)
    }
  }

  private async exclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      this.busy = true
      try {
        return await task()
      } finally {
        this.busy = false
      }
    })
    this.queue = run.catch(() => {})
    return run
  }

  private emit(event: ThreadEvent) {
    for (const listener of this.listeners) {
      listener(event)
    }
    for (const listener of ownerListeners.get(threadInfo(this.id).owner) ?? []) {
      listener(this.id, event)
    }
  }
}

const removeOriginals = (input: ThreadInput) => input.attachments?.forEach((file) => rmSync(file.path, { force: true }))

// 启动 agent 进程时定下、之后改不了的东西：选项、AGENTS.md 这类说明文件、agent 的版本。任何一个变了就要换一个进程
function launchStamp(options: unknown[], dirs: string[], command: string): string {
  const stat = (file: string) => {
    try {
      const info = statSync(file)
      return `${info.mtimeMs}:${info.size}`
    } catch {
      return ''
    }
  }
  const files = dirs.flatMap((dir) => ['AGENTS.md', 'CLAUDE.md'].map((name) => stat(path.join(dir, name))))
  const binary = (process.env.PATH ?? '').split(':').flatMap((dir) => {
    try {
      return [stat(realpathSync(path.join(dir, command)))]
    } catch {
      return []
    }
  })[0]
  return createHash('sha256').update(JSON.stringify([options, files, binary])).digest('hex').slice(0, 16)
}

export function createThread(options: ThreadOptions): Thread {
  const id = createThreadDir({
    type: 'thread',
    time: new Date().toISOString(),
    agent: options.agent,
    owner: options.owner,
    cwd: options.cwd,
    ...(options.instructions && { instructions: options.instructions }),
  })
  return getThread(id)!
}

export function getThread(id: string): Thread | undefined {
  let thread = threads.get(id)
  if (!thread && threadExists(id)) {
    thread = new Thread(id)
    threads.set(id, thread)
  }
  return thread
}

// 某个 app 的所有 thread 的变化：后端启动前就要注册，接上的回答在后端启动时的变化也能收到
export function onThreadEvent(owner: string, listener: (threadId: string, event: ThreadEvent) => void): () => void {
  let set = ownerListeners.get(owner)
  if (!set) {
    set = new Set()
    ownerListeners.set(owner, set)
  }
  set.add(listener)
  return () => set.delete(listener)
}

export function runningCount(agent: AgentId): number {
  return [...threads.values()].filter((thread) => thread.state() !== 'idle' && threadInfo(thread.id).agent === agent).length
}

// 后端启动时接上还在运行的 agent 进程，从头读它们的输出；在一轮里却没有进程的，这一轮以出错结束
export function startThreads() {
  for (const id of listThreads()) {
    const info = threadInfo(id)
    const host = attachHost(hostDir(id))
    if (!host && !info.inTurn) {
      continue
    }
    const thread = getThread(id)!
    if (host) {
      const items = readItems(id, host.itemsFrom)
      const recorded = Math.max(0, ...items.map((item) => ('offset' in item && item.offset) || 0))
      const turnEnds = new Set(items.flatMap((item) => (item.type === 'turn_end' && item.offset !== undefined ? [item.offset] : [])))
      thread.attach(host, recorded, turnEnds)
    }
    if (info.inTurn) {
      thread.resumeTurn(info.turnStartedAt ?? info.updatedAt)
    }
  }
  const poll = () => {
    for (const thread of active) {
      thread.poll()
    }
  }
  // 先把接上的输出读完，再接受新的消息
  poll()
  setInterval(poll, pollInterval).unref()
}

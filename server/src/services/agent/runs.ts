import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { LineReader } from '../../line-reader.js'
import { agentRunsDir } from '../../paths.js'
import { isAlive, isRunning, processStartTime } from '../../process.js'
import type { ProcessIdentity } from '../../process.js'
import { adapters } from './adapters.js'
import { saveLimits } from './limits.js'
import type { AgentOutput } from './output.js'
import { closeInput, inputOpen, sendInterrupt, sendMessage, spawnAgent, stopRelay } from './process.js'
import type { RunFiles } from './process.js'
import type { AgentRecord, Live, LiveEvent, Provider } from './types.js'

// cwd：agent 在哪个目录里干活；filesDir：工具结果里的图片存在这里；resume：接着 agent 那边的这个会话，没有就开一个新的；
// instructions：追加的系统提示；model、effort：没有时用 agent 的默认
export type RunOptions = {
  provider: Provider
  cwd: string
  filesDir: string
  resume?: string
  instructions?: string
  model?: string
  effort?: string
}

// 发起方接收运行产生的东西。同一行输出产生的几条记录一起给，发起方一次记下，后端重启时不会只记下其中一部分
export type RunHandler = {
  records(records: AgentRecord[]): void
  event(event: LiveEvent): void
  // 运行结束了，结束时补的记录已经给过
  finished(): void
}

// 一次运行：从启动 agent 到 agent 进程退出。答完后还会接着处理插的话，有后台任务时等任务结束后接着回答，
// 答完、没有后台任务，又过了一会儿没人插话，就关上输入让 agent 退出
export type Run = {
  readonly provider: Provider
  // 还能插话
  readonly open: boolean
  live(): Live
  // 插话，interrupt 是先打断正在做的事；输入已经关上或者交不过去时返回 false
  send(text: string, options?: { interrupt?: boolean }): Promise<boolean>
  // 结束整个进程组，包括转发进程和 agent 在后台启动的任务
  stop(): void
  finished: Promise<void>
}

// 运行目录里的 state.json。owner、ref：发起的 app 和它用来认出这次运行的标识，后端重启后据此交还；
// time：开始的时间；stopped：被停止了，结果记成停止而不是出错
type RunState = { owner: string; ref: string; options: RunOptions; time: string; agent: ProcessIdentity; stopped?: true }

type Active = { state: RunState; output: AgentOutput; open: boolean; settledSince?: number }

const pollInterval = 200
// 答完后这么久没人插话、也没有后台任务，就关上输入让 agent 退出
const settleDelay = 1500

const runDir = (id: string) => path.join(agentRunsDir, id)
const statePath = (id: string) => path.join(runDir(id), 'state.json')
const runFiles = (id: string): RunFiles => ({
  input: path.join(runDir(id), 'input.fifo'),
  relay: path.join(runDir(id), 'relay.pid'),
  output: path.join(runDir(id), 'output.jsonl'),
  errors: path.join(runDir(id), 'errors.log'),
})

const active = new Map<string, Active>()

// 先写临时文件再改名，不会出现写了一半的 state.json
function writeState(id: string, state: RunState) {
  writeFileSync(`${statePath(id)}.tmp`, JSON.stringify(state) + '\n')
  renameSync(`${statePath(id)}.tmp`, statePath(id))
}

function readRunState(id: string): RunState | undefined {
  try {
    return JSON.parse(readFileSync(statePath(id), 'utf8'))
  } catch {
    return undefined
  }
}

// 不适用于这个 agent 的模型和思考程度去掉，用 agent 的默认
export function fitOptions(provider: Provider, options: { model?: string; effort?: string }): { model?: string; effort?: string } {
  const { models, efforts } = adapters[provider]
  const fits = (value: string | undefined, names: readonly string[] | undefined) => (value && (!names || names.includes(value)) ? value : undefined)
  const model = fits(options.model, models)
  const effort = fits(options.effort, efforts)
  return { ...(model && { model }), ...(effort && { effort }) }
}

// 消息里怎么让这个 agent 查看本机的文件
export const viewHint = (provider: Provider) => adapters[provider].viewHint

export function runningCount(provider: Provider): number {
  return [...active.values()].filter((run) => run.state.options.provider === provider).length
}

// 启动 agent 并把 prompt 交给它；启动失败时返回 undefined
export function startRun(owner: string, ref: string, options: RunOptions, prompt: string, handler: RunHandler): Run | undefined {
  const id = randomUUID()
  const fitted: RunOptions = { ...options, model: undefined, effort: undefined, ...fitOptions(options.provider, options) }
  const files = runFiles(id)
  mkdirSync(runDir(id), { recursive: true })
  const { resume, model, effort, instructions } = fitted
  const pid = spawnAgent(files, adapters[fitted.provider].command({ sessionId: resume, model, effort, instructions }), fitted.cwd)
  const startedAt = pid && processStartTime(pid)
  if (!pid || !startedAt) {
    rmSync(runDir(id), { recursive: true, force: true })
    return undefined
  }
  const state: RunState = { owner, ref, options: fitted, time: new Date().toISOString(), agent: { pid, startedAt } }
  writeState(id, state)
  const run = follow(id, state, 0, handler, true)
  // prompt 排在写入队列的最前面，之后插的话都在它后面，不用等转发进程就绪；交不过去时结束 agent，运行照常以出错结束
  void run.send(prompt).then((sent) => sent || run.stop())
  return run
}

// 后端启动时，把这个 app 发起的、还没结束的运行交还给它接着跟进。attach 返回发起方已经记下的最大 offset 和接收方；
// 返回 undefined 表示它已经记下了这次运行的结束，只是没来得及清理
export function resumeRuns(owner: string, attach: (ref: string) => { recorded: number; handler: RunHandler } | undefined): { ref: string; run: Run }[] {
  if (!existsSync(agentRunsDir)) {
    return []
  }
  const resumed: { ref: string; run: Run }[] = []
  for (const id of readdirSync(agentRunsDir)) {
    const state = readRunState(id)
    // 没有 state.json：agent 没能启动
    if (!state) {
      rmSync(runDir(id), { recursive: true, force: true })
      continue
    }
    if (state.owner !== owner || active.has(id)) {
      continue
    }
    const attached = attach(state.ref)
    if (!attached) {
      rmSync(runDir(id), { recursive: true, force: true })
      continue
    }
    resumed.push({ ref: state.ref, run: follow(id, state, attached.recorded, attached.handler, inputOpen(runFiles(id))) })
  }
  return resumed
}

// 以 agent 进程退出为结束，而不是 result。后端重启后接上的，看管道和转发进程还在不在
function follow(id: string, state: RunState, recorded: number, handler: RunHandler, open: boolean): Run {
  const { provider, filesDir, resume } = state.options
  const output = adapters[provider].output({ filesDir, recorded, sessionId: resume })
  const files = runFiles(id)
  const run: Active = { state, output, open }
  active.set(id, run)
  let finish!: () => void
  const finished = new Promise<void>((resolve) => (finish = resolve))

  const reader = new LineReader(files.output)
  const readNew = () => {
    for (const line of reader.read()) {
      const { records, events, limits } = output.push(line.text, line.end)
      if (limits) {
        saveLimits(provider, limits)
      }
      if (records.length > 0) {
        handler.records(records)
      }
      for (const event of events) {
        handler.event(event)
      }
    }
  }
  const settle = () => {
    if (!run.open || !output.answered || output.backgroundTasks() > 0) {
      run.settledSince = undefined
      return
    }
    run.settledSince ??= Date.now()
    if (Date.now() - run.settledSince >= settleDelay) {
      run.open = false
      void closeInput(files)
    }
  }

  // 接上之前就已经不是同一个进程了（比如后端重启期间 agent 结束了）
  const replaced = !isRunning(state.agent)
  const timer = setInterval(() => {
    readNew()
    if (!replaced && isAlive(state.agent.pid)) {
      settle()
      return
    }
    clearInterval(timer)
    readNew()
    run.open = false
    const errors = existsSync(files.errors) ? readFileSync(files.errors, 'utf8').trim() : ''
    const records = output.finish({ startedAt: state.time, stopped: Boolean(state.stopped), errors })
    if (records.length > 0) {
      handler.records(records)
    }
    // 转发进程正常情况下已经结束；agent 异常退出时它还在
    stopRelay(files)
    rmSync(runDir(id), { recursive: true, force: true })
    active.delete(id)
    handler.finished()
    finish()
  }, pollInterval)

  return {
    provider,
    get open() {
      return run.open
    },
    live: () => output.current(),
    send: async (text, { interrupt = false } = {}) => {
      if (!run.open) {
        return false
      }
      try {
        if (interrupt) {
          await sendInterrupt(files)
        }
        await sendMessage(files, text)
      } catch {
        return false
      }
      run.settledSince = undefined
      return true
    },
    stop: () => {
      if (!active.has(id)) {
        return
      }
      run.open = false
      state.stopped = true
      writeState(id, state)
      try {
        process.kill(-state.agent.pid, 'SIGTERM')
      } catch {
        // 已经结束了
      }
    },
    finished,
  }
}

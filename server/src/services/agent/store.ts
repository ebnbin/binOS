import { randomUUID } from 'node:crypto'
import {
  appendFileSync,
  closeSync,
  existsSync,
  fstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { agentServiceDir } from '../../paths.js'
import { drivers } from './drivers/index.js'
import type { AgentId, Context, Item, Tokens } from './types.js'

// 每个 thread 一个目录：items.jsonl 是它的内容（只追加，唯一的真相），thread.json 是从内容算出的缓存，
// files/ 是附件、工具结果里的图片和回复引用的文件的快照，host/ 是正在持有 agent 进程的 host
export const threadsDir = path.join(agentServiceDir, 'threads')
export const threadDir = (id: string) => path.join(threadsDir, id)
export const filesDir = (id: string) => path.join(threadDir(id), 'files')
export const hostDir = (id: string) => path.join(threadDir(id), 'host')
const itemsPath = (id: string) => path.join(threadDir(id), 'items.jsonl')
const infoPath = (id: string) => path.join(threadDir(id), 'thread.json')

// thread.json：itemsSize 是算的时候 items.jsonl 有多大，version 是算的方式，任何一个对不上就从头重算，丢了也能重建
const infoVersion = 1

export type ThreadInfo = {
  version: number
  itemsSize: number
  count: number
  agent: AgentId
  owner: string
  cwd: string
  instructions?: string
  createdAt: string
  updatedAt: string
  turns: number
  // 最后一轮还没结束，以及它开始的时间
  inTurn: boolean
  turnStartedAt?: string
  outcome?: 'stopped' | 'error'
  context?: Context
  // 最近一轮结束的时间
  repliedAt?: string
  // 最近一轮用的模型和思考程度
  model?: string
  effort?: string
  // agent 那边的会话，agent 进程重新启动时接着它
  agentSession?: string
  // 用掉的 token，按模型：每一轮结束时报告的是 agent 那边的会话到这时为止的累计（usageLatest），
  // agent 那边换了会话（比如接不上了重开）时，之前的累计并进 usageBefore
  usageBefore: Record<string, Tokens>
  usageLatest: Record<string, Tokens>
  // 每一轮按 API 价格折算的花费（美元）和这一轮结束的时间，只有能折算的 agent 有
  costs: [time: string, cost: number][]
}

export function addUsage(a: Record<string, Tokens>, b: Record<string, Tokens>): Record<string, Tokens> {
  const sum = { ...a }
  for (const [model, tokens] of Object.entries(b)) {
    const base = sum[model] ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
    sum[model] = {
      input: base.input + tokens.input,
      output: base.output + tokens.output,
      cacheRead: base.cacheRead + tokens.cacheRead,
      cacheWrite: base.cacheWrite + tokens.cacheWrite,
    }
  }
  return sum
}

export function listThreads(): string[] {
  return existsSync(threadsDir) ? readdirSync(threadsDir).filter(threadExists) : []
}

export function threadExists(id: string): boolean {
  return /^[\w-]+$/.test(id) && existsSync(itemsPath(id))
}

// 只有这个后端写 thread（根目录锁保证），建目录、写第一条之后才算有了这个 thread
export function createThread(first: Extract<Item, { type: 'thread' }>): string {
  const id = randomUUID()
  mkdirSync(threadDir(id), { recursive: true })
  appendItems(id, [first])
  return id
}

// from：从第几条开始。最后一行可能是崩溃时没写完的半行，跳过
export function readItems(id: string, from = 0): Item[] {
  if (!existsSync(itemsPath(id))) {
    return []
  }
  const items: Item[] = []
  for (const line of readFileSync(itemsPath(id), 'utf8').split('\n')) {
    try {
      items.push(JSON.parse(line))
    } catch {
      // 空行或没写完的半行
    }
  }
  return from > 0 ? items.slice(from) : items
}

function emptyInfo(): ThreadInfo {
  return {
    version: infoVersion,
    itemsSize: 0,
    count: 0,
    agent: 'claude',
    owner: '',
    cwd: '',
    createdAt: '',
    updatedAt: '',
    turns: 0,
    inTurn: false,
    usageBefore: {},
    usageLatest: {},
    costs: [],
  }
}

const usageCost = (agent: AgentId, usage: Record<string, Tokens>) => {
  const cost = drivers[agent].cost
  return cost ? Object.entries(usage).reduce((sum, [model, tokens]) => sum + cost(model, tokens), 0) : 0
}

function apply(info: ThreadInfo, item: Item) {
  info.count += 1
  info.createdAt ||= item.time
  info.updatedAt = item.time
  switch (item.type) {
    case 'thread':
      info.agent = item.agent
      info.owner = item.owner
      info.cwd = item.cwd
      if (item.instructions) {
        info.instructions = item.instructions
      }
      break
    case 'input':
      if (item.mode === 'start') {
        info.turns += 1
        info.inTurn = true
        info.turnStartedAt = item.time
        delete info.outcome
        info.model = item.model
        info.effort = item.effort
      }
      break
    case 'agent_session':
      if (info.agentSession && info.agentSession !== item.id) {
        info.usageBefore = addUsage(info.usageBefore, info.usageLatest)
        info.usageLatest = {}
      }
      info.agentSession = item.id
      break
    case 'turn_end':
      info.inTurn = false
      delete info.turnStartedAt
      info.repliedAt = item.time
      if (item.outcome) {
        info.outcome = item.outcome
      }
      if (item.context) {
        info.context = item.context
      }
      if (item.usage) {
        const cost = usageCost(info.agent, item.usage) - usageCost(info.agent, info.usageLatest)
        info.usageLatest = item.usage
        if (cost > 0) {
          info.costs.push([item.time, cost])
        }
      }
      break
  }
}

// 先写临时文件再改名，不会出现写了一半的 thread.json
function writeInfo(id: string, info: ThreadInfo) {
  writeFileSync(`${infoPath(id)}.tmp`, JSON.stringify(info, null, 2) + '\n')
  renameSync(`${infoPath(id)}.tmp`, infoPath(id))
}

function readInfoFile(id: string): ThreadInfo | undefined {
  try {
    return JSON.parse(readFileSync(infoPath(id), 'utf8'))
  } catch {
    return undefined
  }
}

function itemsSize(id: string): number {
  try {
    return statSync(itemsPath(id)).size
  } catch {
    return 0
  }
}

// 内存里记着每个 thread 算到哪了，追加时接着算；后端刚启动时先看 thread.json，和 items.jsonl 对得上就直接用
const infos = new Map<string, ThreadInfo>()

export function threadInfo(id: string): ThreadInfo {
  const size = itemsSize(id)
  const cached = infos.get(id) ?? readInfoFile(id)
  if (cached?.itemsSize === size && cached.version === infoVersion) {
    infos.set(id, cached)
    return cached
  }
  const info = emptyInfo()
  for (const item of readItems(id)) {
    apply(info, item)
  }
  info.itemsSize = size
  writeInfo(id, info)
  infos.set(id, info)
  return info
}

// 崩溃时没写完的半行后面先换行，不和新的条目连在一起
function endsWithNewline(id: string): boolean {
  const fd = openSync(itemsPath(id), 'r')
  try {
    const size = fstatSync(fd).size
    const last = Buffer.alloc(1)
    return size === 0 || (readSync(fd, last, 0, 1, size - 1) === 1 && last[0] === 10)
  } finally {
    closeSync(fd)
  }
}

// 同一行输出产生的几条一次写进去，后端重启时不会只记下其中一部分。返回第一条是第几条
export function appendItems(id: string, items: Item[]): number {
  const exists = existsSync(itemsPath(id))
  const info = exists ? threadInfo(id) : emptyInfo()
  const index = info.count
  const lines = items.map((item) => JSON.stringify(item) + '\n').join('')
  appendFileSync(itemsPath(id), exists && !endsWithNewline(id) ? '\n' + lines : lines)
  for (const item of items) {
    apply(info, item)
  }
  info.itemsSize = itemsSize(id)
  writeInfo(id, info)
  infos.set(id, info)
  return index
}

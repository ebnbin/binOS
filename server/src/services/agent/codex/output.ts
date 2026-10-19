import { constants, copyFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { emptyLive, outputLimit } from '../output.js'
import type { AgentOutput, OutputOptions } from '../output.js'
import type { AgentRecord, Limits, Live, LiveEvent, Status, Tokens } from '../types.js'
import { codexLimits } from './app-server.js'
import type { RateLimits } from './app-server.js'

type TokenBreakdown = { totalTokens: number; inputTokens: number; cachedInputTokens: number; cacheWriteInputTokens: number; outputTokens: number }
type TurnInfo = { id: string; status: string; error: { message: string } | null }
// codex app-server 的条目里用到的字段
type Item = {
  type: string
  id: string
  text?: string
  summary?: string[]
  command?: string
  aggregatedOutput?: string | null
  exitCode?: number | null
  status?: string
  changes?: { path: string; kind: { type: string }; diff: string }[]
  server?: string
  tool?: string
  arguments?: unknown
  result?: { content?: { type?: string; text?: string }[] } | null
  error?: { message?: string } | null
  query?: string
  prompt?: string | null
  path?: string
}
// app-server 输出的一行：请求的响应，或者通知
type Line = {
  id?: number
  result?: { thread?: { id: string }; model?: string }
  method?: string
  // 通知发出的时间；响应没有
  emittedAtMs?: number
  params?: {
    threadId?: string
    turn?: TurnInfo
    item?: Item
    itemId?: string
    delta?: string
    summaryIndex?: number
    startedAtMs?: number
    completedAtMs?: number
    error?: { message: string }
    willRetry?: boolean
    tokenUsage?: { total: TokenBreakdown; last: TokenBreakdown; modelContextWindow: number | null }
    rateLimits?: RateLimits
  }
}

type ToolResult = Extract<AgentRecord, { type: 'tool_result' }>

// 把 codex 转接进程的输出逐行转成记录和临时内容的变化。
// 命令、改文件这些按 binOS 已有的工具显示：命令是 Bash，改文件是每个文件一次 Patch
export class CodexOutput implements AgentOutput {
  private readonly filesDir: string
  private readonly recorded: number
  private threadId: string | undefined
  private live = emptyLive()
  private thinkingStartedAt: number | undefined
  // 还没有结果的工具调用：条目 id → 对应的工具调用 id（改了几个文件就有几个）
  private readonly openTools = new Map<string, string[]>()
  private model: string | undefined
  private outputTokens = 0
  private contextTokens: number | undefined
  private contextWindow: number | undefined
  private sessionUsage: Tokens | undefined
  private retries = 0
  private error: string | undefined
  private lastTurn: TurnInfo | undefined
  answered = false

  constructor(options: OutputOptions) {
    this.filesDir = options.filesDir
    this.recorded = options.recorded
    this.threadId = options.sessionId
  }

  backgroundTasks(): number {
    return 0
  }

  current(): Live {
    return this.live
  }

  push(text: string, offset: number): { records: AgentRecord[]; events: LiveEvent[]; limits?: Limits } {
    const records: AgentRecord[] = []
    const events: LiveEvent[] = []
    let line: Line
    try {
      line = JSON.parse(text)
    } catch {
      return { records, events }
    }
    const fresh = offset > this.recorded
    const time = new Date(line.emittedAtMs ?? Date.now()).toISOString()
    const record = (fields: AgentRecord) => records.push({ ...fields, offset } as AgentRecord)
    const status = (value: Status | null) => {
      this.live.status = value
      events.push({ type: 'status', status: value })
    }

    // 建立或接上会话的响应
    const thread = line.result?.thread
    if (thread) {
      this.model = line.result?.model ?? this.model
      if (thread.id !== this.threadId) {
        this.threadId = thread.id
        record({ type: 'agent', time, provider: 'codex', sessionId: thread.id })
      }
    }
    const params = line.params
    if (!line.method || !params) {
      return fresh ? { records, events } : { records: [], events: [] }
    }
    if (line.method === 'account/rateLimits/updated') {
      const limits = params.rateLimits && codexLimits(params.rateLimits, time)
      return fresh && limits ? { records, events, limits } : { records, events }
    }
    // 子 agent 的会话也在同一个连接上，只看自己的
    if (params.threadId && params.threadId !== this.threadId) {
      return { records, events }
    }

    switch (line.method) {
      case 'turn/started':
        this.answered = false
        this.retries = 0
        status({ type: 'requesting' })
        break
      case 'turn/completed':
        this.lastTurn = params.turn
        this.answered = true
        records.push(...this.flushLive(time).map((fields) => ({ ...fields, offset }) as AgentRecord))
        status(null)
        break
      case 'item/started':
        if (params.item) {
          this.itemStarted(params.item, params.startedAtMs, time, record, status)
        }
        break
      case 'item/completed':
        if (params.item) {
          this.itemCompleted(params.item, params.completedAtMs, time, record, status)
        }
        break
      case 'item/reasoning/summaryPartAdded':
        if (params.summaryIndex && this.live.thinking) {
          this.appendThinking('\n\n', events)
        }
        break
      case 'item/reasoning/summaryTextDelta':
        if (params.delta) {
          this.appendThinking(params.delta, events)
        }
        break
      case 'item/agentMessage/delta':
        if (params.delta) {
          this.appendText(params.delta, events)
        }
        break
      case 'thread/tokenUsage/updated': {
        const usage = params.tokenUsage
        if (usage) {
          this.outputTokens += usage.last.outputTokens
          this.contextTokens = usage.last.totalTokens
          this.contextWindow = usage.modelContextWindow ?? this.contextWindow
          this.sessionUsage = {
            input: usage.total.inputTokens - usage.total.cachedInputTokens,
            output: usage.total.outputTokens,
            cacheRead: usage.total.cachedInputTokens,
            cacheWrite: usage.total.cacheWriteInputTokens,
          }
        }
        break
      }
      case 'error':
        if (params.willRetry) {
          status({ type: 'retrying', attempt: ++this.retries })
        } else if (params.error) {
          this.error = params.error.message
        }
        break
    }
    return fresh ? { records, events } : { records: [], events: [] }
  }

  finish(options: { startedAt: string; stopped: boolean; errors: string }): AgentRecord[] {
    const time = new Date().toISOString()
    const records = this.flushLive(time)
    for (const ids of this.openTools.values()) {
      for (const toolUseId of ids) {
        records.push({ type: 'tool_result', time, toolUseId, status: 'error' })
      }
    }
    const turn = this.lastTurn
    const error = options.stopped
      ? undefined
      : turn
        ? turn.status === 'failed'
          ? turn.error?.message || this.error || 'agent 返回了错误'
          : undefined
        : options.errors || this.error || 'agent 异常结束'
    const outcome = options.stopped ? 'stopped' : error === undefined ? undefined : 'error'
    records.push({
      type: 'result',
      time,
      durationMs: Math.max(Date.parse(time) - Date.parse(options.startedAt), 0),
      ...(outcome && { outcome }),
      ...(error !== undefined && { error }),
      ...(this.model && { model: this.model }),
      ...(this.outputTokens > 0 && { outputTokens: this.outputTokens }),
      ...(this.contextTokens && this.contextWindow && { context: { tokens: this.contextTokens, window: this.contextWindow } }),
      ...(this.model && this.sessionUsage && { sessionUsage: { [this.model]: this.sessionUsage } }),
    })
    return records
  }

  private appendThinking(delta: string, events: LiveEvent[]) {
    this.live.thinking += delta
    events.push({ type: 'thinking', text: delta })
  }

  private appendText(delta: string, events: LiveEvent[]) {
    this.live.text += delta
    events.push({ type: 'text', text: delta })
  }

  private flushLive(time: string): AgentRecord[] {
    const records: AgentRecord[] = []
    if (this.live.thinking) {
      records.push({ type: 'thinking', time, text: this.live.thinking })
    }
    if (this.live.text) {
      records.push({ type: 'text', time, text: this.live.text })
    }
    this.live.thinking = ''
    this.live.text = ''
    this.thinkingStartedAt = undefined
    return records
  }

  private toolUse(item: Item, time: string, record: (fields: AgentRecord) => void, uses: { name: string; input: unknown }[]) {
    const ids = uses.map((_, index) => (uses.length > 1 ? `${item.id}:${index}` : item.id))
    uses.forEach(({ name, input }, index) => record({ type: 'tool_use', time, id: ids[index], name, input }))
    this.openTools.set(item.id, ids)
  }

  private toolResult(item: Item, time: string, record: (fields: AgentRecord) => void, result: Omit<ToolResult, 'type' | 'time' | 'toolUseId'>) {
    for (const toolUseId of this.openTools.get(item.id) ?? []) {
      record({ type: 'tool_result', time, toolUseId, ...result })
    }
    this.openTools.delete(item.id)
  }

  private itemStarted(
    item: Item,
    startedAtMs: number | undefined,
    time: string,
    record: (fields: AgentRecord) => void,
    status: (value: Status | null) => void,
  ) {
    switch (item.type) {
      case 'reasoning':
        this.thinkingStartedAt = startedAtMs
        status({ type: 'thinking' })
        break
      case 'agentMessage':
        status(null)
        break
      case 'commandExecution':
        this.toolUse(item, time, record, [{ name: 'Bash', input: { command: unwrapShell(item.command ?? '') } }])
        status({ type: 'tool', name: 'Bash' })
        break
      case 'fileChange':
        this.toolUse(
          item,
          time,
          record,
          (item.changes ?? []).map((change) => ({ name: 'Patch', input: { file_path: change.path, kind: change.kind.type, diff: change.diff } })),
        )
        status({ type: 'tool', name: 'Patch' })
        break
      case 'mcpToolCall': {
        const name = `mcp__${item.server}__${item.tool}`
        this.toolUse(item, time, record, [{ name, input: item.arguments ?? {} }])
        status({ type: 'tool', name })
        break
      }
      case 'collabAgentToolCall':
        this.toolUse(item, time, record, [{ name: 'Agent', input: { description: item.prompt ?? item.tool ?? '' } }])
        status({ type: 'tool', name: 'Agent' })
        break
      case 'contextCompaction':
        status({ type: 'compacting' })
        break
    }
  }

  private itemCompleted(
    item: Item,
    completedAtMs: number | undefined,
    time: string,
    record: (fields: AgentRecord) => void,
    status: (value: Status | null) => void,
  ) {
    const failed = item.status === 'failed' || item.status === 'declined' || item.status === 'interrupted'
    switch (item.type) {
      case 'reasoning': {
        const text = item.summary?.join('\n\n') || this.live.thinking
        const durationMs = this.thinkingStartedAt !== undefined && completedAtMs ? Math.max(completedAtMs - this.thinkingStartedAt, 0) : undefined
        if (text) {
          record({ type: 'thinking', time, text, ...(durationMs !== undefined && { durationMs }) })
        }
        this.live.thinking = ''
        this.thinkingStartedAt = undefined
        status(null)
        break
      }
      case 'agentMessage': {
        const text = item.text || this.live.text
        if (text) {
          record({ type: 'text', time, text })
        }
        this.live.text = ''
        break
      }
      case 'commandExecution':
        this.toolResult(item, time, record, {
          status: failed || (item.exitCode ?? 0) !== 0 ? 'error' : 'done',
          ...truncated(item.aggregatedOutput ?? ''),
        })
        status(null)
        break
      case 'fileChange':
      case 'collabAgentToolCall':
        this.toolResult(item, time, record, { status: failed ? 'error' : 'done' })
        status(null)
        break
      case 'mcpToolCall': {
        const output = item.error?.message ?? (item.result?.content ?? []).flatMap((part) => (part.text ? [part.text] : [])).join('\n')
        this.toolResult(item, time, record, { status: failed ? 'error' : 'done', ...truncated(output) })
        status(null)
        break
      }
      // 搜索词要搜完才知道，开始和结果一起记
      case 'webSearch':
        this.toolUse(item, time, record, [{ name: 'WebSearch', input: { query: item.query ?? '' } }])
        this.toolResult(item, time, record, { status: 'done' })
        break
      // 查看的图片存一份，和工具结果里的图片一样显示
      case 'imageView': {
        this.toolUse(item, time, record, [{ name: 'ViewImage', input: { file_path: item.path ?? '' } }])
        this.toolResult(item, time, record, { status: 'done', ...this.imageOf(item) })
        break
      }
      case 'contextCompaction':
        record({ type: 'compact', time, trigger: 'auto' })
        status(null)
        break
    }
  }

  // 按条目命名：重读同一份输出时写出同样的文件
  private imageOf(item: Item): { images?: string[] } {
    const extension = path.extname(item.path ?? '').slice(1).toLowerCase()
    if (!item.path || !['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extension)) {
      return {}
    }
    const name = `${item.id}.${extension}`
    try {
      mkdirSync(this.filesDir, { recursive: true })
      copyFileSync(item.path, path.join(this.filesDir, name), constants.COPYFILE_FICLONE)
      return { images: [name] }
    } catch {
      return {}
    }
  }
}

// codex 把命令包在 /bin/zsh -lc '…' 里执行，显示里面的命令
function unwrapShell(command: string): string {
  const match = /^\/bin\/(?:ba|z)?sh -lc (?:'((?:[^']|'\\'')*)'|"((?:[^"\\]|\\.)*)")$/s.exec(command)
  if (!match) {
    return command
  }
  return match[1] !== undefined ? match[1].replaceAll("'\\''", "'") : match[2].replace(/\\(.)/gs, '$1')
}

function truncated(text: string): { output?: string; truncated?: true } {
  const trimmed = text.trimEnd()
  return {
    ...(trimmed && { output: trimmed.slice(-outputLimit) }),
    ...(trimmed.length > outputLimit && { truncated: true as const }),
  }
}

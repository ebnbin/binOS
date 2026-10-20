import { constants, copyFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import type { Limits, LiveEvent, ToolDetail, Tokens } from '../../types.js'
import { LiveState, truncatedOutput } from '../decoder.js'
import type { DecodedItem, Decoder, DecoderOptions } from '../types.js'
import { codexLimits } from './app-server.js'
import type { RateLimits } from './app-server.js'

type TokenBreakdown = { totalTokens: number; inputTokens: number; cachedInputTokens: number; cacheWriteInputTokens: number; outputTokens: number }
type TurnInfo = { id: string; status: string; error: { message: string } | null }
// codex app-server 的条目里用到的字段
type CodexItem = {
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
    item?: CodexItem
    itemId?: string
    delta?: string
    summaryIndex?: number
    startedAtMs?: number
    completedAtMs?: number
    error?: { message: string; additionalDetails?: string | null; codexErrorInfo?: unknown }
    willRetry?: boolean
    tokenUsage?: { total: TokenBreakdown; last: TokenBreakdown; modelContextWindow: number | null }
    rateLimits?: RateLimits
  }
}

type ToolResult = Extract<DecodedItem, { type: 'tool_result' }>
type Emit = (fields: DecodedItem) => void

// 把 codex app-server 的输出逐行转成条目和临时内容的变化。改文件的条目可能改了几个文件，每个文件一次工具调用
export class CodexDecoder implements Decoder {
  private readonly filesDir: string
  private thread: string | undefined
  private readonly live = new LiveState()
  // 还没有结果的工具调用：条目 id → 对应的工具调用 id（改了几个文件就有几个）
  private readonly openTools = new Map<string, string[]>()
  private model: string | undefined
  private contextTokens: number | undefined
  private contextWindow: number | undefined
  private usage: Tokens | undefined
  // 这一轮的：输出 token、重试次数、出错的原因、最后报告的 turn
  private outputTokens = 0
  private retries = 0
  private error: string | undefined
  private lastTurn: TurnInfo | undefined
  answered = false

  constructor(options: DecoderOptions) {
    this.filesDir = options.filesDir
    this.thread = options.agentSession
  }

  backgroundTasks(): number {
    return 0
  }

  current() {
    return this.live.current()
  }

  push(text: string, offset: number): { items: DecodedItem[]; events: LiveEvent[]; limits?: Limits; authFailed?: true } {
    const items: DecodedItem[] = []
    const events: LiveEvent[] = []
    let line: Line
    try {
      line = JSON.parse(text)
    } catch {
      return { items, events }
    }
    const time = new Date(line.emittedAtMs ?? Date.now()).toISOString()
    const item: Emit = (fields) => items.push({ ...fields, offset } as DecodedItem)

    // 建立或接上会话的响应
    const thread = line.result?.thread
    if (thread) {
      this.model = line.result?.model ?? this.model
      if (thread.id !== this.thread) {
        this.thread = thread.id
        item({ type: 'agent_session', time, id: thread.id })
      }
    }
    const params = line.params
    if (!line.method || !params) {
      return { items, events }
    }
    if (line.method === 'account/rateLimits/updated') {
      const limits = params.rateLimits && codexLimits(params.rateLimits, time)
      return limits ? { items, events, limits } : { items, events }
    }
    // 子 agent 的会话也在同一个连接上，只看自己的
    if (params.threadId && params.threadId !== this.thread) {
      return { items, events }
    }
    // 请求因为登录无效被拒绝：Codex 自己还会重试几次，第一次就报告
    if (line.method === 'error' && isUnauthorized(params.error)) {
      return { items, events, authFailed: true }
    }

    switch (line.method) {
      case 'turn/started':
        this.answered = false
        this.retries = 0
        this.live.status({ type: 'requesting' }, events)
        break
      case 'turn/completed':
        this.lastTurn = params.turn
        this.answered = true
        items.push(...this.live.flush(time).map((fields) => ({ ...fields, offset }) as DecodedItem))
        this.live.status(null, events)
        break
      case 'item/started':
        if (params.item) {
          this.itemStarted(params.item, params.startedAtMs, time, item, events)
        }
        break
      case 'item/completed':
        if (params.item) {
          this.itemCompleted(params.item, params.completedAtMs, time, item, events)
        }
        break
      case 'item/reasoning/summaryPartAdded':
        if (params.summaryIndex && this.live.thinking) {
          this.live.appendThinking('\n\n', events)
        }
        break
      case 'item/reasoning/summaryTextDelta':
        if (params.delta) {
          this.live.appendThinking(params.delta, events)
        }
        break
      case 'item/agentMessage/delta':
        if (params.delta) {
          this.live.appendText(params.delta, events)
        }
        break
      case 'thread/tokenUsage/updated': {
        const usage = params.tokenUsage
        if (usage) {
          this.outputTokens += usage.last.outputTokens
          this.contextTokens = usage.last.totalTokens
          this.contextWindow = usage.modelContextWindow ?? this.contextWindow
          this.usage = {
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
          this.live.status({ type: 'retrying', attempt: ++this.retries }, events)
        } else if (params.error) {
          this.error = params.error.message
        }
        break
    }
    return { items, events }
  }

  endTurn(options: { startedAt: string; stopped: boolean; error?: string }): DecodedItem[] {
    const time = new Date().toISOString()
    const items = this.live.flush(time)
    for (const ids of this.openTools.values()) {
      for (const callId of ids) {
        items.push({ type: 'tool_result', time, callId, status: 'error' })
      }
    }
    const turn = this.lastTurn
    const error = options.stopped
      ? undefined
      : (options.error ??
        (turn ? (turn.status === 'failed' ? turn.error?.message || this.error || 'agent 返回了错误' : undefined) : this.error || 'agent 异常结束'))
    const outcome = options.stopped ? 'stopped' : error === undefined ? undefined : 'error'
    items.push({
      type: 'turn_end',
      time,
      durationMs: Math.max(Date.parse(time) - Date.parse(options.startedAt), 0),
      ...(outcome && { outcome }),
      ...(error !== undefined && { error }),
      ...(this.model && { model: this.model }),
      ...(this.outputTokens > 0 && { outputTokens: this.outputTokens }),
      ...(this.contextTokens && this.contextWindow && { context: { tokens: this.contextTokens, window: this.contextWindow } }),
      ...(this.model && this.usage && { usage: { [this.model]: this.usage } }),
    })
    this.openTools.clear()
    this.outputTokens = 0
    this.retries = 0
    this.error = undefined
    this.lastTurn = undefined
    this.answered = false
    return items
  }

  private toolCall(item: CodexItem, time: string, emit: Emit, calls: { name: string; tool: ToolDetail; input?: unknown }[]) {
    const ids = calls.map((_, index) => (calls.length > 1 ? `${item.id}:${index}` : item.id))
    calls.forEach((call, index) => emit({ type: 'tool_call', time, id: ids[index], ...call }))
    this.openTools.set(item.id, ids)
  }

  private toolResult(item: CodexItem, time: string, emit: Emit, result: Omit<ToolResult, 'type' | 'time' | 'callId'>) {
    for (const callId of this.openTools.get(item.id) ?? []) {
      emit({ type: 'tool_result', time, callId, ...result })
    }
    this.openTools.delete(item.id)
  }

  private itemStarted(item: CodexItem, startedAtMs: number | undefined, time: string, emit: Emit, events: LiveEvent[]) {
    switch (item.type) {
      case 'reasoning':
        this.live.thinkingStartedAt = startedAtMs
        this.live.status({ type: 'thinking' }, events)
        break
      case 'agentMessage':
        this.live.status(null, events)
        break
      case 'commandExecution':
        this.toolCall(item, time, emit, [{ name: 'shell', tool: { kind: 'command', command: unwrapShell(item.command ?? '') } }])
        this.live.status({ type: 'tool', name: 'shell' }, events)
        break
      case 'fileChange':
        this.toolCall(
          item,
          time,
          emit,
          (item.changes ?? []).map((change) => ({
            name: 'apply_patch',
            tool: { kind: 'edit', path: change.path, change: { type: 'diff', op: patchOp(change.kind.type), diff: change.diff } },
          })),
        )
        this.live.status({ type: 'tool', name: 'apply_patch' }, events)
        break
      case 'mcpToolCall': {
        const name = `${item.server}.${item.tool}`
        this.toolCall(item, time, emit, [{ name, tool: { kind: 'mcp', server: item.server ?? '', tool: item.tool ?? '' }, input: item.arguments ?? {} }])
        this.live.status({ type: 'tool', name }, events)
        break
      }
      case 'collabAgentToolCall':
        this.toolCall(item, time, emit, [{ name: item.tool ?? 'spawn_agent', tool: { kind: 'subagent', description: item.prompt ?? item.tool ?? '' } }])
        this.live.status({ type: 'tool', name: item.tool ?? 'spawn_agent' }, events)
        break
      case 'contextCompaction':
        this.live.status({ type: 'compacting' }, events)
        break
    }
  }

  private itemCompleted(item: CodexItem, completedAtMs: number | undefined, time: string, emit: Emit, events: LiveEvent[]) {
    const failed = item.status === 'failed' || item.status === 'declined' || item.status === 'interrupted'
    switch (item.type) {
      case 'reasoning': {
        const text = item.summary?.join('\n\n') || this.live.thinking
        const startedAt = this.live.thinkingStartedAt
        const durationMs = startedAt !== undefined && completedAtMs ? Math.max(completedAtMs - startedAt, 0) : undefined
        if (text) {
          emit({ type: 'thinking', time, text, ...(durationMs !== undefined && { durationMs }) })
        }
        this.live.clearThinking()
        this.live.status(null, events)
        break
      }
      case 'agentMessage': {
        const text = item.text || this.live.text
        if (text) {
          emit({ type: 'text', time, text })
        }
        this.live.clearText()
        break
      }
      case 'commandExecution':
        this.toolResult(item, time, emit, {
          status: failed || (item.exitCode ?? 0) !== 0 ? 'error' : 'done',
          ...truncatedOutput(item.aggregatedOutput ?? ''),
        })
        this.live.status(null, events)
        break
      case 'fileChange':
      case 'collabAgentToolCall':
        this.toolResult(item, time, emit, { status: failed ? 'error' : 'done' })
        this.live.status(null, events)
        break
      case 'mcpToolCall': {
        const output = item.error?.message ?? (item.result?.content ?? []).flatMap((part) => (part.text ? [part.text] : [])).join('\n')
        this.toolResult(item, time, emit, { status: failed ? 'error' : 'done', ...truncatedOutput(output) })
        this.live.status(null, events)
        break
      }
      // 搜索词要搜完才知道，开始和结果一起记
      case 'webSearch':
        this.toolCall(item, time, emit, [{ name: 'web_search', tool: { kind: 'web_search', query: item.query ?? '' } }])
        this.toolResult(item, time, emit, { status: 'done' })
        break
      // 查看的图片存一份，和工具结果里的图片一样显示
      case 'imageView':
        this.toolCall(item, time, emit, [{ name: 'view_image', tool: { kind: 'image_view', path: item.path ?? '' } }])
        this.toolResult(item, time, emit, { status: 'done', ...this.imageOf(item) })
        break
      case 'contextCompaction':
        emit({ type: 'compact', time, trigger: 'auto' })
        this.live.status(null, events)
        break
    }
  }

  // 按条目命名：重读同一份输出时写出同样的文件
  private imageOf(item: CodexItem): { images?: string[] } {
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

const patchOp = (kind: string): 'add' | 'update' | 'delete' => (kind === 'add' || kind === 'delete' ? kind : 'update')

// codex 把命令包在 /bin/zsh -lc '…' 里执行，显示里面的命令
function unwrapShell(command: string): string {
  const match = /^\/bin\/(?:ba|z)?sh -lc (?:'((?:[^']|'\\'')*)'|"((?:[^"\\]|\\.)*)")$/s.exec(command)
  if (!match) {
    return command
  }
  return match[1] !== undefined ? match[1].replaceAll("'\\''", "'") : match[2].replace(/\\(.)/gs, '$1')
}

function isUnauthorized(error: { message: string; additionalDetails?: string | null; codexErrorInfo?: unknown } | undefined) {
  return Boolean(error) && (error!.codexErrorInfo === 'unauthorized' || /unauthorized \(401\)|\b401 Unauthorized\b/i.test(`${error!.message} ${error!.additionalDetails ?? ''}`))
}

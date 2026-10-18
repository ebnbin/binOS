import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { snapshotFiles } from './reply-files.js'
import type { Limits, Live, LiveEvent, QuotaWindow, Status, TaskProgress, Tokens, TranscriptRecord } from './types.js'

// 工具结果的文字只留末尾这么多：出错时要看的报错一般在最后
const outputLimit = 64 * 1024
const imageExtensions: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

type Usage = {
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
}
type ModelUsage = {
  contextWindow?: number
  inputTokens?: number
  outputTokens?: number
  cacheReadInputTokens?: number
  cacheCreationInputTokens?: number
}
type ContentPart = { type: string; text?: string; source?: { type: string; media_type?: string; data?: string } }
type Block = {
  type: string
  text?: string
  thinking?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
  tool_use_id?: string
  is_error?: boolean
  content?: string | ContentPart[]
}
// claude --output-format stream-json 的一行里用到的字段
type Line = {
  type: string
  subtype?: string
  session_id?: string
  timestamp?: string
  parent_tool_use_id?: string | null
  model?: string
  status?: string | null
  attempt?: number
  tool_use_id?: string
  is_backgrounded?: boolean
  owned_by_subagent?: boolean
  description?: string
  usage?: { total_tokens?: number; tool_uses?: number }
  compact_metadata?: { trigger?: string; pre_tokens?: number; post_tokens?: number }
  event?: {
    type: string
    message?: { id?: string }
    content_block?: { type: string; name?: string }
    delta?: { type: string; text?: string; thinking?: string }
    usage?: Usage
  }
  message?: { id?: string; content?: Block[] | string; usage?: Usage }
  is_error?: boolean
  result?: string
  modelUsage?: Record<string, ModelUsage>
  rate_limit_info?: { status?: string; unifiedWindows?: Record<string, { utilization?: number; resetsAt?: number } | undefined> }
}

type ToolResult = Extract<TranscriptRecord, { type: 'tool_result' }>
type HeldResult = Omit<ToolResult, 'type' | 'time' | 'status' | 'offset'>

const emptyLive = (): Live => ({ thinking: '', text: '', files: {}, status: null, tasks: {} })

// 把 Claude 的输出逐行转成 transcript 记录和临时内容的变化。输出总是从头读：
// 后端重启后，已经记下的那些行（offset 不超过 recorded）只用来恢复状态，不再产生记录和推送
export class ClaudeOutput {
  private readonly filesDir: string
  private readonly recorded: number
  private sessionId: string | undefined
  private live = emptyLive()
  // 这一段思考开始的时间；后端重启时正在想的那段不知道
  private thinkingStartedAt: number | undefined
  // 还没有结果的工具调用。在后台运行的调用马上返回"已启动"，真正结束要等任务结束：先把这个结果留着，任务结束时再记
  private readonly openTools = new Map<string, { parent?: string; background: boolean }>()
  private readonly held = new Map<string, HeldResult>()
  // 每条模型回复（含子 agent 的）报告过的最大输出 token：完整消息里的是生成到那时的，主对话的最终数在流式的 message_delta 里。
  // 主对话最近一次请求的输入就是当前上下文的大小
  private readonly outputs = new Map<string, number>()
  private streamingMessage: string | undefined
  private contextTokens: number | undefined
  private model: string | undefined
  private result: Line | undefined
  // 答完了一轮（输出了 result）、之后还没有新的动静：插的话会让它接着答，没人插话就可以让它退出了
  answered = false

  constructor(options: { filesDir: string; recorded: number; sessionId: string | undefined }) {
    this.filesDir = options.filesDir
    this.recorded = options.recorded
    this.sessionId = options.sessionId
  }

  // 主对话里还在后台运行、没有结束的工具调用
  backgroundTasks(): number {
    return [...this.openTools.values()].filter((tool) => tool.background && !tool.parent).length
  }

  current(): Live {
    return this.live
  }

  // offset 是这一行在输出文件里的结束位置；limits 是这一行报告的订阅额度
  push(text: string, offset: number): { records: TranscriptRecord[]; events: LiveEvent[]; limits?: Limits } {
    const records: TranscriptRecord[] = []
    const events: LiveEvent[] = []
    let line: Line
    try {
      line = JSON.parse(text)
    } catch {
      return { records, events }
    }
    const fresh = offset > this.recorded
    if (line.type === 'rate_limit_event') {
      const limits = limitsOf(line)
      return fresh && limits ? { records, events, limits } : { records, events }
    }
    const parent = line.parent_tool_use_id ?? undefined
    const time = line.timestamp ?? new Date().toISOString()
    const record = (fields: TranscriptRecord) => {
      records.push({ ...fields, offset, ...(parent && { parent }) } as TranscriptRecord)
    }
    const status = (value: Status | null) => {
      this.live.status = value
      events.push({ type: 'status', status: value })
    }
    const task = (toolUseId: string, progress: TaskProgress | null) => {
      if (progress) {
        this.live.tasks[toolUseId] = progress
      } else if (this.live.tasks[toolUseId]) {
        delete this.live.tasks[toolUseId]
      } else {
        return
      }
      events.push({ type: 'task', toolUseId, progress })
    }

    // 有了模型的回复或结果，才说明 Claude 那边的会话真的建立起来了
    if (!parent && line.session_id && line.session_id !== this.sessionId && (line.type === 'assistant' || line.type === 'result')) {
      this.sessionId = line.session_id
      record({ type: 'agent', time, provider: 'claude', sessionId: line.session_id })
    }

    if (!parent && (line.type === 'stream_event' || line.type === 'assistant' || line.subtype === 'init')) {
      this.answered = false
    }

    switch (line.type) {
      case 'stream_event':
        if (!parent && line.event) {
          this.handleStreamEvent(line.event, status, events)
        }
        break
      case 'assistant':
        this.trackUsage(line, parent)
        for (const block of Array.isArray(line.message?.content) ? line.message.content : []) {
          if (block.type === 'thinking' && block.thinking) {
            const durationMs = !parent && this.thinkingStartedAt !== undefined ? Math.max(Date.parse(time) - this.thinkingStartedAt, 0) : undefined
            record({ type: 'thinking', time, text: block.thinking, ...(durationMs !== undefined && { durationMs }) })
            if (!parent) {
              this.live.thinking = ''
              this.thinkingStartedAt = undefined
            }
          } else if (block.type === 'text' && block.text) {
            const files = snapshotFiles(block.text, this.filesDir)
            record({ type: 'text', time, text: block.text, ...(Object.keys(files).length > 0 && { files }) })
            if (!parent) {
              this.live.text = ''
              this.live.files = {}
            }
          } else if (block.type === 'tool_use' && block.id && block.name) {
            const background = block.input?.run_in_background === true
            this.openTools.set(block.id, { parent, background })
            record({ type: 'tool_use', time, id: block.id, name: block.name, input: block.input ?? {}, ...(background && { background }) })
          }
        }
        break
      case 'user':
        for (const block of Array.isArray(line.message?.content) ? line.message.content : []) {
          if (block.type !== 'tool_result' || !block.tool_use_id) {
            continue
          }
          const result = this.resultOf(block)
          if (this.openTools.get(block.tool_use_id)?.background) {
            this.held.set(block.tool_use_id, result)
            continue
          }
          this.openTools.delete(block.tool_use_id)
          task(block.tool_use_id, null)
          record({ type: 'tool_result', time, status: block.is_error ? 'error' : 'done', ...result })
        }
        break
      case 'system':
        if (!parent) {
          this.handleSystem(line, time, record, status, task)
        }
        break
      case 'result':
        if (!parent) {
          this.result = line
          this.answered = true
          // 被打断时正在想的、正在写的不会再写完了，照样记下
          records.push(...this.flushLive(time).map((fields) => ({ ...fields, offset }) as TranscriptRecord))
          status(this.waitingStatus())
        }
        break
    }
    return fresh ? { records, events } : { records: [], events: [] }
  }

  // 一轮结束时补记：被停止或出错时还没想完的思考、还没写完的文字照样记下；还没有结果的工具调用不会再有结果，记成出错
  finish(options: { startedAt: string; stopped: boolean; errors: string }): TranscriptRecord[] {
    const time = new Date().toISOString()
    const records = this.flushLive(time)
    for (const [toolUseId, { parent }] of this.openTools) {
      records.push({ type: 'tool_result', time, ...(this.held.get(toolUseId) ?? { toolUseId }), status: 'error', ...(parent && { parent }) })
    }

    const result = this.result
    const error = options.stopped
      ? undefined
      : result
        ? result.is_error
          ? result.result || 'agent 返回了错误'
          : undefined
        : options.errors || 'agent 异常结束'
    const outcome = options.stopped ? 'stopped' : error === undefined ? undefined : 'error'
    const modelUsage = Object.entries(result?.modelUsage ?? {})
    const window = Math.max(0, ...modelUsage.map(([, usage]) => usage.contextWindow ?? 0))
    const outputTokens = [...this.outputs.values()].reduce((sum, value) => sum + value, 0)
    records.push({
      type: 'result',
      time,
      durationMs: Math.max(Date.parse(time) - Date.parse(options.startedAt), 0),
      ...(outcome && { outcome }),
      ...(error !== undefined && { error }),
      ...(this.model && { model: this.model }),
      ...(this.outputs.size > 0 && { outputTokens }),
      ...(this.contextTokens && window && { context: { tokens: this.contextTokens, window } }),
      ...(modelUsage.length > 0 && {
        sessionUsage: Object.fromEntries(
          modelUsage.map(([model, usage]): [string, Tokens] => [
            model,
            {
              input: usage.inputTokens ?? 0,
              output: usage.outputTokens ?? 0,
              cacheRead: usage.cacheReadInputTokens ?? 0,
              cacheWrite: usage.cacheCreationInputTokens ?? 0,
            },
          ]),
        ),
      }),
    })
    return records
  }

  private flushLive(time: string): TranscriptRecord[] {
    const records: TranscriptRecord[] = []
    if (this.live.thinking) {
      records.push({ type: 'thinking', time, text: this.live.thinking })
    }
    if (this.live.text) {
      const files = snapshotFiles(this.live.text, this.filesDir)
      records.push({ type: 'text', time, text: this.live.text, ...(Object.keys(files).length > 0 && { files }) })
    }
    this.live.thinking = ''
    this.live.text = ''
    this.live.files = {}
    this.thinkingStartedAt = undefined
    return records
  }

  // 答完了但还有后台任务时，agent 等任务结束后会接着答
  private waitingStatus(): Status | null {
    const tasks = this.backgroundTasks()
    return this.answered && tasks > 0 ? { type: 'waiting', tasks } : null
  }

  private handleStreamEvent(event: NonNullable<Line['event']>, status: (value: Status | null) => void, events: LiveEvent[]) {
    const block = event.content_block
    if (event.type === 'message_start' && event.message?.id) {
      this.streamingMessage = event.message.id
    } else if (event.type === 'message_delta' && this.streamingMessage && event.usage?.output_tokens) {
      this.countOutput(this.streamingMessage, event.usage.output_tokens)
    } else if (event.type === 'content_block_start' && block?.type === 'thinking') {
      this.thinkingStartedAt = Date.now()
      status({ type: 'thinking' })
    } else if (event.type === 'content_block_start' && block?.type === 'tool_use' && block.name) {
      // 工具调用的参数要整段生成完才发出来，写大文件时要很久，先显示在调用哪个工具
      status({ type: 'tool', name: block.name })
    } else if (event.type === 'content_block_stop') {
      status(null)
    } else if (event.type === 'content_block_delta' && event.delta?.type === 'thinking_delta' && event.delta.thinking) {
      this.live.thinking += event.delta.thinking
      events.push({ type: 'thinking', text: event.delta.thinking })
    } else if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta.text) {
      this.live.text += event.delta.text
      events.push({ type: 'text', text: event.delta.text })
      // 文字里刚写完一个本机文件的引用，马上存快照，页面随即就能显示
      if (event.delta.text.includes(')')) {
        for (const [reference, name] of Object.entries(snapshotFiles(this.live.text, this.filesDir, this.live.files))) {
          this.live.files[reference] = name
          events.push({ type: 'file', path: reference, name })
        }
      }
    }
  }

  private handleSystem(
    line: Line,
    time: string,
    record: (fields: TranscriptRecord) => void,
    status: (value: Status | null) => void,
    task: (toolUseId: string, progress: TaskProgress | null) => void,
  ) {
    switch (line.subtype) {
      case 'init':
        this.model = line.model
        break
      case 'status':
        status(line.status === 'requesting' ? { type: 'requesting' } : line.status === 'compacting' ? { type: 'compacting' } : null)
        break
      case 'api_retry':
        status({ type: 'retrying', attempt: line.attempt ?? 1 })
        break
      case 'compact_boundary': {
        const meta = line.compact_metadata ?? {}
        if (meta.post_tokens) {
          this.contextTokens = meta.post_tokens
        }
        record({
          type: 'compact',
          time,
          trigger: meta.trigger ?? 'auto',
          ...(meta.pre_tokens !== undefined && { preTokens: meta.pre_tokens }),
          ...(meta.post_tokens !== undefined && { postTokens: meta.post_tokens }),
        })
        break
      }
      // 子 agent 自己发起的任务对应的不是这一层的工具调用
      case 'task_started': {
        const tool = line.tool_use_id && !line.owned_by_subagent ? this.openTools.get(line.tool_use_id) : undefined
        if (tool && line.is_backgrounded) {
          tool.background = true
        }
        break
      }
      // 子 agent 自己发起的任务也对应着一次（子 agent 的）工具调用，进展照样显示
      case 'task_progress':
        if (line.tool_use_id) {
          task(line.tool_use_id, {
            ...(line.description && { activity: line.description }),
            ...(line.usage?.tool_uses !== undefined && { toolUses: line.usage.tool_uses }),
            ...(line.usage?.total_tokens !== undefined && { tokens: line.usage.total_tokens }),
          })
        }
        break
      case 'task_notification': {
        const id = line.tool_use_id
        if (id) {
          task(id, null)
        }
        if (!id || line.owned_by_subagent || !this.openTools.get(id)?.background) {
          break
        }
        this.openTools.delete(id)
        record({ type: 'tool_result', time, ...(this.held.get(id) ?? { toolUseId: id }), status: line.status === 'completed' ? 'done' : 'error' })
        this.held.delete(id)
        if (this.answered) {
          status(this.waitingStatus())
        }
        break
      }
    }
  }

  private trackUsage(line: Line, parent: string | undefined) {
    const usage = line.message?.usage
    if (!usage || !line.message?.id) {
      return
    }
    this.countOutput(line.message.id, usage.output_tokens ?? 0)
    if (!parent) {
      this.contextTokens = (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0)
    }
  }

  private countOutput(messageId: string, tokens: number) {
    this.outputs.set(messageId, Math.max(this.outputs.get(messageId) ?? 0, tokens))
  }

  // 图片按工具调用和位置命名：重读同一份输出时写出同样的文件
  private resultOf(block: Block): HeldResult {
    const parts = typeof block.content === 'string' ? [{ type: 'text', text: block.content }] : (block.content ?? [])
    const text = parts
      .flatMap((part) => (part.type === 'text' && part.text ? [part.text] : []))
      .join('\n')
      .trimEnd()
    const images = parts.flatMap((part, index) => {
      const extension = part.type === 'image' && part.source?.type === 'base64' && imageExtensions[part.source.media_type ?? '']
      if (!extension || !part.source?.data) {
        return []
      }
      const name = `${block.tool_use_id}-${index}.${extension}`
      mkdirSync(this.filesDir, { recursive: true })
      writeFileSync(path.join(this.filesDir, name), Buffer.from(part.source.data, 'base64'))
      return [name]
    })
    return {
      toolUseId: block.tool_use_id!,
      ...(text && { output: text.slice(-outputLimit) }),
      ...(text.length > outputLimit && { truncated: true as const }),
      ...(images.length > 0 && { images }),
    }
  }
}

function windowOf(line: Line, name: string): QuotaWindow | undefined {
  const window = line.rate_limit_info?.unifiedWindows?.[name]
  return typeof window?.utilization === 'number' && typeof window.resetsAt === 'number'
    ? { utilization: window.utilization, resetsAt: window.resetsAt }
    : undefined
}

function limitsOf(line: Line): Limits | undefined {
  const status = line.rate_limit_info?.status
  if (!status) {
    return undefined
  }
  const fiveHour = windowOf(line, 'five_hour')
  const sevenDay = windowOf(line, 'seven_day')
  return { status, ...(fiveHour && { fiveHour }), ...(sevenDay && { sevenDay }), updatedAt: line.timestamp ?? new Date().toISOString() }
}

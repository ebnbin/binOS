import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Limits, LiveEvent, QuotaWindow, Status, Tokens } from '../../types.js'
import { LiveState, truncatedOutput } from '../decoder.js'
import type { DecodedItem, Decoder, DecoderOptions } from '../types.js'
import { claudeTool } from './tools.js'

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
// Claude Code 在命令输出后面附加的说明，不是命令本身的输出
const harnessNote = /^Shell cwd was reset to .*$/gm

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
  error_status?: number
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

type ToolResult = Extract<DecodedItem, { type: 'tool_result' }>
type HeldResult = Omit<ToolResult, 'type' | 'time' | 'status' | 'offset'>

// 把 Claude 的输出逐行转成条目和临时内容的变化
export class ClaudeDecoder implements Decoder {
  private readonly filesDir: string
  private agentSession: string | undefined
  private readonly live = new LiveState()
  // 还没有结果的工具调用。在后台运行的调用马上返回"已启动"，真正结束要等任务结束：先把这个结果留着，任务结束时再记
  private readonly openTools = new Map<string, { parent?: string; background: boolean }>()
  private readonly held = new Map<string, HeldResult>()
  // 这一轮每条模型回复（含子 agent 的）报告过的最大输出 token：完整消息里的是生成到那时的，主对话的最终数在流式的 message_delta 里
  private readonly outputs = new Map<string, number>()
  private streamingMessage: string | undefined
  // 主对话最近一次请求的输入就是当前上下文的大小
  private contextTokens: number | undefined
  private model: string | undefined
  // 这一轮最近的 result
  private result: Line | undefined
  answered = false

  constructor(options: DecoderOptions) {
    this.filesDir = options.filesDir
    this.agentSession = options.agentSession
  }

  backgroundTasks(): number {
    return [...this.openTools.values()].filter((tool) => tool.background && !tool.parent).length
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
    if (line.type === 'rate_limit_event') {
      const limits = limitsOf(line)
      return limits ? { items, events, limits } : { items, events }
    }
    // 请求因为登录无效被拒绝：Claude 自己还会重试几次，第一次就报告
    if (line.type === 'system' && line.subtype === 'api_retry' && line.error_status === 401) {
      return { items, events, authFailed: true }
    }
    const parent = line.parent_tool_use_id ?? undefined
    const time = line.timestamp ?? new Date().toISOString()
    const item = (fields: DecodedItem) => {
      items.push({ ...fields, offset, ...(parent && { parent }) } as DecodedItem)
    }

    // 有了模型的回复或结果，才说明 Claude 那边的会话真的建立起来了
    if (!parent && line.session_id && line.session_id !== this.agentSession && (line.type === 'assistant' || line.type === 'result')) {
      this.agentSession = line.session_id
      item({ type: 'agent_session', time, id: line.session_id })
    }

    if (!parent && (line.type === 'stream_event' || line.type === 'assistant' || line.subtype === 'init')) {
      this.answered = false
    }

    switch (line.type) {
      case 'stream_event':
        if (!parent && line.event) {
          this.handleStreamEvent(line.event, events)
        }
        break
      case 'assistant':
        this.trackUsage(line, parent)
        for (const block of Array.isArray(line.message?.content) ? line.message.content : []) {
          if (block.type === 'thinking' && block.thinking) {
            const startedAt = this.live.thinkingStartedAt
            const durationMs = !parent && startedAt !== undefined ? Math.max(Date.parse(time) - startedAt, 0) : undefined
            item({ type: 'thinking', time, text: block.thinking, ...(durationMs !== undefined && { durationMs }) })
            if (!parent) {
              this.live.clearThinking()
            }
          } else if (block.type === 'text' && block.text) {
            item({ type: 'text', time, text: block.text })
            if (!parent) {
              this.live.clearText()
            }
          } else if (block.type === 'tool_use' && block.id && block.name) {
            const background = block.input?.run_in_background === true
            this.openTools.set(block.id, { parent, background })
            item({ type: 'tool_call', time, id: block.id, name: block.name, ...claudeTool(block.name, block.input ?? {}), ...(background && { background }) })
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
          this.live.task(block.tool_use_id, null, events)
          item({ type: 'tool_result', time, status: block.is_error ? 'error' : 'done', ...result })
        }
        break
      case 'system':
        if (!parent) {
          this.handleSystem(line, time, item, events)
        }
        break
      case 'result':
        if (!parent) {
          this.result = line
          this.answered = true
          // 被打断时正在想的、正在写的不会再写完了，照样记下
          items.push(...this.live.flush(time).map((fields) => ({ ...fields, offset }) as DecodedItem))
          this.live.status(this.waitingStatus(), events)
        }
        break
    }
    return { items, events }
  }

  endTurn(options: { startedAt: string; stopped: boolean; error?: string }): DecodedItem[] {
    const time = new Date().toISOString()
    const items = this.live.flush(time)
    for (const [callId, { parent }] of this.openTools) {
      items.push({ type: 'tool_result', time, ...(this.held.get(callId) ?? { callId }), status: 'error', ...(parent && { parent }) })
    }
    const result = this.result
    const error = options.stopped
      ? undefined
      : (options.error ?? (result ? (result.is_error ? result.result || 'agent 返回了错误' : undefined) : 'agent 异常结束'))
    const outcome = options.stopped ? 'stopped' : error === undefined ? undefined : 'error'
    const modelUsage = Object.entries(result?.modelUsage ?? {})
    const window = Math.max(0, ...modelUsage.map(([, usage]) => usage.contextWindow ?? 0))
    const outputTokens = [...this.outputs.values()].reduce((sum, value) => sum + value, 0)
    items.push({
      type: 'turn_end',
      time,
      durationMs: Math.max(Date.parse(time) - Date.parse(options.startedAt), 0),
      ...(outcome && { outcome }),
      ...(error !== undefined && { error }),
      ...(this.model && { model: this.model }),
      ...(this.outputs.size > 0 && { outputTokens }),
      ...(this.contextTokens && window && { context: { tokens: this.contextTokens, window } }),
      ...(modelUsage.length > 0 && {
        usage: Object.fromEntries(
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
    this.openTools.clear()
    this.held.clear()
    this.outputs.clear()
    this.streamingMessage = undefined
    this.result = undefined
    this.answered = false
    return items
  }

  // 答完了但还有后台任务时，agent 等任务结束后会接着答
  private waitingStatus(): Status | null {
    const tasks = this.backgroundTasks()
    return this.answered && tasks > 0 ? { type: 'waiting', tasks } : null
  }

  private handleStreamEvent(event: NonNullable<Line['event']>, events: LiveEvent[]) {
    const block = event.content_block
    if (event.type === 'message_start' && event.message?.id) {
      this.streamingMessage = event.message.id
    } else if (event.type === 'message_delta' && this.streamingMessage && event.usage?.output_tokens) {
      this.countOutput(this.streamingMessage, event.usage.output_tokens)
    } else if (event.type === 'content_block_start' && block?.type === 'thinking') {
      this.live.thinkingStartedAt = Date.now()
      this.live.status({ type: 'thinking' }, events)
    } else if (event.type === 'content_block_start' && block?.type === 'tool_use' && block.name) {
      // 工具调用的参数要整段生成完才发出来，写大文件时要很久，先显示在调用哪个工具
      this.live.status({ type: 'tool', name: block.name }, events)
    } else if (event.type === 'content_block_stop') {
      this.live.status(null, events)
    } else if (event.type === 'content_block_delta' && event.delta?.type === 'thinking_delta' && event.delta.thinking) {
      this.live.appendThinking(event.delta.thinking, events)
    } else if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta.text) {
      this.live.appendText(event.delta.text, events)
    }
  }

  private handleSystem(line: Line, time: string, item: (fields: DecodedItem) => void, events: LiveEvent[]) {
    switch (line.subtype) {
      case 'init':
        this.model = line.model
        break
      case 'status':
        this.live.status(line.status === 'requesting' ? { type: 'requesting' } : line.status === 'compacting' ? { type: 'compacting' } : null, events)
        break
      case 'api_retry':
        this.live.status({ type: 'retrying', attempt: line.attempt ?? 1 }, events)
        break
      case 'compact_boundary': {
        const meta = line.compact_metadata ?? {}
        if (meta.post_tokens) {
          this.contextTokens = meta.post_tokens
        }
        item({
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
          this.live.task(
            line.tool_use_id,
            {
              ...(line.description && { activity: line.description }),
              ...(line.usage?.tool_uses !== undefined && { toolUses: line.usage.tool_uses }),
              ...(line.usage?.total_tokens !== undefined && { tokens: line.usage.total_tokens }),
            },
            events,
          )
        }
        break
      case 'task_notification': {
        const id = line.tool_use_id
        if (id) {
          this.live.task(id, null, events)
        }
        if (!id || line.owned_by_subagent || !this.openTools.get(id)?.background) {
          break
        }
        this.openTools.delete(id)
        item({ type: 'tool_result', time, ...(this.held.get(id) ?? { callId: id }), status: line.status === 'completed' ? 'done' : 'error' })
        this.held.delete(id)
        if (this.answered) {
          this.live.status(this.waitingStatus(), events)
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
      .replace(harnessNote, '')
    const images = parts.flatMap((part, index) => {
      const extension = part.type === 'image' && part.source?.type === 'base64' && imageExtensions[part.source.media_type ?? '']
      if (!extension || !part.source?.data) {
        return []
      }
      const name = `${block.tool_use_id}-${index}.${extension}`
      mkdirSync(this.filesDir, { recursive: true })
      try {
        writeFileSync(path.join(this.filesDir, name), Buffer.from(part.source.data, 'base64'), { flag: 'wx' })
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      }
      return [name]
    })
    return { callId: block.tool_use_id!, ...truncatedOutput(text), ...(images.length > 0 && { images }) }
  }
}

// Claude 报告的各个窗口按名字对应窗口的长度
const windowMinutes: Record<string, number> = { five_hour: 5 * 60, seven_day: 7 * 24 * 60 }

function limitsOf(line: Line): Limits | undefined {
  const status = line.rate_limit_info?.status
  if (!status) {
    return undefined
  }
  const windows = Object.entries(windowMinutes).flatMap(([id, minutes]): QuotaWindow[] => {
    const window = line.rate_limit_info?.unifiedWindows?.[id]
    return typeof window?.utilization === 'number' && typeof window.resetsAt === 'number'
      ? [{ id, minutes, utilization: window.utilization, resetsAt: window.resetsAt }]
      : []
  })
  // allowed_warning 是快用完了的提醒，照样能用；rejected 才是被限流了
  return { limited: status === 'rejected', windows, updatedAt: line.timestamp ?? new Date().toISOString() }
}

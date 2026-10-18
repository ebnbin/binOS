import type { Attachment, Live, Status, TranscriptRecord } from '@binos/server/apps/agent/types'
import { formatDuration, formatModel, formatTokens, useNow } from '../format.ts'
import { AgentCall } from './AgentCall.tsx'
import { Alert } from './Alert.tsx'
import { AttachmentList } from './Attachments.tsx'
import { CopyButton } from './CopyButton.tsx'
import { Markdown } from './Markdown.tsx'
import { Thinking } from './Thinking.tsx'
import { ToolGroup } from './ToolCall.tsx'
import type { ToolCallItem, ToolResult } from '../tool-calls.ts'
import styles from './Transcript.module.css'

type Entry = { record: TranscriptRecord; index: number }
type Result = Extract<TranscriptRecord, { type: 'result' }>
type Compact = Extract<TranscriptRecord, { type: 'compact' }>

type Item =
  | { kind: 'user'; key: string; text: string }
  | { kind: 'attachments'; key: string; attachments: Attachment[] }
  | { kind: 'text'; key: string; text: string; files?: Record<string, string> }
  | { kind: 'thinking'; key: string; text: string; durationMs?: number }
  | { kind: 'tools'; key: string; calls: ToolCallItem[] }
  | { kind: 'agent'; key: string; call: ToolCallItem }
  | { kind: 'compact'; key: string; record: Compact }
  | { kind: 'interrupted'; key: string }
  // reply：这一轮回复的全部文字，用于复制
  | { kind: 'result'; key: string; record: Result; reply: string }

// 整个 transcript 共用的：工具结果按调用 id，子 agent 的记录按它所属的调用 id
type Context = {
  sessionId: number
  results: Map<string, ToolResult>
  children: Map<string, Entry[]>
  live: Live | null
  now: number
}

// 启动子 agent 的工具
const agentTools = new Set(['Agent', 'Task'])

// 相邻的普通工具调用合成一组
function buildItems(entries: Entry[], context: Context): Item[] {
  const items: Item[] = []
  // 这一轮到目前为止回复的文字；一轮进行中出现的 user 是插话，不另起一轮
  let replies: string[] = []
  let inTurn = false
  for (const { record, index } of entries) {
    const key = String(index)
    switch (record.type) {
      case 'user':
        if (!inTurn) {
          replies = []
          inTurn = true
        }
        if (record.interrupt) {
          items.push({ kind: 'interrupted', key: `${key}-interrupted` })
        }
        if (record.attachments?.length) {
          items.push({ kind: 'attachments', key: `${key}-attachments`, attachments: record.attachments })
        }
        if (record.text.trim()) {
          items.push({ kind: 'user', key, text: record.text })
        }
        break
      case 'thinking':
        items.push({ kind: 'thinking', key, text: record.text, durationMs: record.durationMs })
        break
      case 'text':
        if (record.text.trim()) {
          replies.push(record.text)
          items.push({ kind: 'text', key, text: record.text, files: record.files })
        }
        break
      case 'tool_use': {
        const call = { use: record, result: context.results.get(record.id), live: context.live !== null }
        const last = items.at(-1)
        if (agentTools.has(record.name)) {
          items.push({ kind: 'agent', key, call })
        } else if (last?.kind === 'tools') {
          last.calls.push(call)
        } else {
          items.push({ kind: 'tools', key, calls: [call] })
        }
        break
      }
      case 'compact':
        items.push({ kind: 'compact', key, record })
        break
      case 'result':
        inTurn = false
        items.push({ kind: 'result', key, record, reply: replies.join('\n\n') })
        break
    }
  }
  return items
}

function Timeline({ entries, context }: { entries: Entry[]; context: Context }) {
  const { sessionId } = context
  return buildItems(entries, context).map((item) => {
    switch (item.kind) {
      case 'user':
        return (
          <div key={item.key} className={styles.user}>
            {item.text}
          </div>
        )
      case 'attachments':
        return <AttachmentList key={item.key} sessionId={sessionId} attachments={item.attachments} />
      case 'text':
        return <Markdown key={item.key} sessionId={sessionId} text={item.text} files={item.files} />
      case 'thinking':
        return <Thinking key={item.key} sessionId={sessionId} text={item.text} durationMs={item.durationMs} />
      case 'tools':
        return <ToolGroup key={item.key} sessionId={sessionId} calls={item.calls} now={context.now} />
      case 'agent': {
        const children = context.children.get(item.call.use.id)
        return (
          <AgentCall
            key={item.key}
            sessionId={sessionId}
            call={item.call}
            progress={context.live?.tasks[item.call.use.id]}
            now={context.now}
            timeline={children && <Timeline entries={children} context={context} />}
          />
        )
      }
      case 'interrupted':
        return (
          <div key={item.key} className={styles.divider}>
            已打断
          </div>
        )
      case 'compact':
        return (
          <div key={item.key} className={styles.divider}>
            {compactText(item.record)}
          </div>
        )
      case 'result':
        return <TurnEnd key={item.key} record={item.record} reply={item.reply} />
    }
  })
}

function compactText({ trigger, preTokens, postTokens }: Compact) {
  const sizes = preTokens !== undefined && postTokens !== undefined ? `（${formatTokens(preTokens)} → ${formatTokens(postTokens)} token）` : ''
  return `${trigger === 'manual' ? '手动' : '自动'}压缩了上下文${sizes}`
}

// 一轮的结尾：停止、出错，以及这一轮的统计
function TurnEnd({ record, reply }: { record: Result; reply: string }) {
  const { durationMs, outputTokens, context, model, outcome, error } = record
  const stats = [
    `用时 ${formatDuration(durationMs)}`,
    outputTokens !== undefined && `输出 ${formatTokens(outputTokens)} token`,
    context && `上下文 ${Math.round((context.tokens / context.window) * 100)}%`,
    model && formatModel(model),
  ].filter(Boolean)
  if (outcome === 'stopped') {
    return <div className={styles.divider}>已停止 · {stats[0]}</div>
  }
  return (
    <>
      {outcome === 'error' && <Alert>{error ?? 'agent 出错了'}</Alert>}
      <div className={styles.stats}>
        {reply && <CopyButton text={reply} label="复制回复" />}
        <span title={context ? `上下文 ${context.tokens.toLocaleString()} / ${context.window.toLocaleString()} token` : undefined}>
          {stats.join(' · ')}
        </span>
      </div>
    </>
  )
}

// runningTool：主对话里还没有结果的最后一次工具调用
function statusText(status: Status | null, live: Live, runningTool: string | undefined) {
  switch (status?.type) {
    case 'requesting':
      return '等待模型'
    case 'thinking':
      return '思考中'
    case 'tool':
      return `正在调用 ${status.name}`
    case 'compacting':
      return '正在压缩上下文'
    case 'waiting':
      return `已答完，等待 ${status.tasks} 个后台任务`
    case 'retrying':
      return `请求失败，第 ${status.attempt} 次重试`
    default:
      return live.text ? '正在回答' : runningTool ? `正在运行 ${runningTool}` : '正在处理'
  }
}

// 进行中的一轮的已用时间，只到秒
function formatElapsed(ms: number) {
  const seconds = Math.max(Math.floor(ms / 1000), 0)
  return seconds < 60 ? `${seconds} 秒` : `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`
}

export function Transcript({ sessionId, records, live }: { sessionId: number; records: TranscriptRecord[]; live: Live | null }) {
  const now = useNow(live !== null)
  const results = new Map<string, ToolResult>()
  const children = new Map<string, Entry[]>()
  const main: Entry[] = []
  records.forEach((record, index) => {
    if (record.type === 'tool_result') {
      results.set(record.toolUseId, record)
    }
    const parent = 'parent' in record ? record.parent : undefined
    if (parent) {
      const siblings = children.get(parent)
      if (siblings) {
        siblings.push({ record, index })
      } else {
        children.set(parent, [{ record, index }])
      }
    } else {
      main.push({ record, index })
    }
  })
  const context: Context = { sessionId, results, children, live, now }
  const runningTool = main.findLast(({ record }) => record.type === 'tool_use' && !results.has(record.id))?.record
  // 这一轮从最后一个 result 之后开始
  const turnStart = records[records.findLastIndex((record) => record.type === 'result') + 1]?.time
  return (
    <>
      <Timeline entries={main} context={context} />
      {live?.thinking && <Thinking sessionId={sessionId} text={live.thinking} live />}
      {live?.text.trim() && <Markdown sessionId={sessionId} text={live.text} files={live.files} />}
      {live && (
        <div className={styles.status}>
          {statusText(live.status, live, runningTool?.type === 'tool_use' ? runningTool.name : undefined)}
          {turnStart && ` · ${formatElapsed(now - Date.parse(turnStart))}`}
        </div>
      )}
    </>
  )
}

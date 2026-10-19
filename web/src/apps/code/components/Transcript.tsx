import type { Attachment, Live, TranscriptRecord } from '@binos/server/apps/code/types'
import type { Status } from '@binos/server/services/agent/types'
import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { formatDuration, formatModel, formatTokens, useNow } from '../format.ts'
import { formatClock, formatDivider, formatFull, sameDay } from '../time.ts'
import { AgentCall } from './AgentCall.tsx'
import { Alert } from './Alert.tsx'
import { AttachmentList } from './Attachments.tsx'
import { CopyButton } from './CopyButton.tsx'
import { Markdown } from './Markdown.tsx'
import { Thinking } from './Thinking.tsx'
import { ToolCall } from './ToolCall.tsx'
import { TurnChanges } from './TurnChanges.tsx'
import { callStatus, fileChanges, isFileEdit, toolKind } from '../tool-calls.ts'
import type { ToolCallItem, ToolCategory, ToolResult } from '../tool-calls.ts'
import styles from './Transcript.module.css'

type Entry = { record: TranscriptRecord; index: number }
type Result = Extract<TranscriptRecord, { type: 'result' }>
type Compact = Extract<TranscriptRecord, { type: 'compact' }>

type Item =
  | { kind: 'user'; key: string; text: string; time: string }
  | { kind: 'time'; key: string; time: string }
  // 一轮从这里开始，主对话按轮分节
  | { kind: 'turn'; key: string }
  | { kind: 'attachments'; key: string; attachments: Attachment[] }
  | { kind: 'text'; key: string; text: string; files?: Record<string, string> }
  | { kind: 'steps'; key: string; steps: Step[] }
  | { kind: 'compact'; key: string; record: Compact }
  | { kind: 'interrupted'; key: string }
  // reply：这一轮回复的全部文字，用于复制；edits：这一轮（包括子 agent）改文件的调用
  | { kind: 'result'; key: string; record: Result; reply: string; edits: ToolCallItem[] }

// 回答过程中的一步：思考、工具调用、子 agent。两段文字之间连续的几步合成一组
type Step =
  | { kind: 'thinking'; key: string; time: string; text: string; durationMs?: number }
  | { kind: 'tool'; key: string; time: string; call: ToolCallItem }
  | { kind: 'agent'; key: string; time: string; call: ToolCallItem }

// 整个 transcript 共用的：工具结果按调用 id，子 agent 的记录按它所属的调用 id
type Context = {
  sessionId: number
  results: Map<string, ToolResult>
  children: Map<string, Entry[]>
  live: Live | null
  now: number
}

// 一轮开始时离上一条记录超过这么久，先显示一条时间
const dividerGap = 30 * 60 * 1000

// 启动子 agent 的工具
const agentTools = new Set(['Agent', 'Task'])

function buildItems(entries: Entry[], context: Context): Item[] {
  const items: Item[] = []
  const addStep = (step: Step) => {
    const last = items.at(-1)
    if (last?.kind === 'steps') {
      last.steps.push(step)
    } else {
      items.push({ kind: 'steps', key: step.key, steps: [step] })
    }
  }
  // 这一轮到目前为止回复的文字和改文件的调用；一轮进行中出现的 user 是插话，不另起一轮
  let replies: string[] = []
  let edits: ToolCallItem[] = []
  let inTurn = false
  // 上一条记录的时间：一轮开始时离它太久或者跨了天，就先显示一条时间
  let lastTime: Date | undefined
  for (const { record, index } of entries) {
    const key = String(index)
    const previous = lastTime
    // 改名不算对话里的动静
    if (record.type !== 'title') {
      lastTime = new Date(record.time)
    }
    switch (record.type) {
      case 'user':
        if (!inTurn) {
          replies = []
          edits = []
          inTurn = true
          items.push({ kind: 'turn', key: `${key}-turn` })
          const time = new Date(record.time)
          if (!previous || time.getTime() - previous.getTime() > dividerGap || !sameDay(time, previous)) {
            items.push({ kind: 'time', key: `${key}-time`, time: record.time })
          }
        }
        if (record.interrupt) {
          items.push({ kind: 'interrupted', key: `${key}-interrupted` })
        }
        if (record.attachments?.length) {
          items.push({ kind: 'attachments', key: `${key}-attachments`, attachments: record.attachments })
        }
        if (record.text.trim()) {
          items.push({ kind: 'user', key, text: record.text, time: record.time })
        }
        break
      case 'thinking':
        addStep({ kind: 'thinking', key, time: record.time, text: record.text, durationMs: record.durationMs })
        break
      case 'text':
        if (record.text.trim()) {
          replies.push(record.text)
          items.push({ kind: 'text', key, text: record.text, files: record.files })
        }
        break
      case 'tool_use': {
        const call = { use: record, result: context.results.get(record.id), live: context.live !== null }
        edits.push(...editCalls(call, context))
        addStep({ kind: agentTools.has(record.name) ? 'agent' : 'tool', key, time: record.time, call })
        break
      }
      case 'compact':
        items.push({ kind: 'compact', key, record })
        break
      case 'result':
        inTurn = false
        items.push({ kind: 'result', key, record, reply: replies.join('\n\n'), edits })
        break
    }
  }
  return items
}

// 这次调用改了文件就是它自己；是子 agent 时，是子 agent 里改文件的调用
function editCalls(call: ToolCallItem, context: Context): ToolCallItem[] {
  if (isFileEdit(call.use)) {
    return [call]
  }
  return (context.children.get(call.use.id) ?? []).flatMap(({ record }) =>
    record.type === 'tool_use' ? editCalls({ use: record, result: context.results.get(record.id), live: call.live }, context) : [],
  )
}

// 主对话按轮分节，tail 放在最后一节的末尾（回答进行中的临时内容）；子 agent 的过程不分节
function Turns({ entries, context, tail }: { entries: Entry[]; context: Context; tail: ReactNode }) {
  const items = buildItems(entries, context)
  const turns: Item[][] = []
  for (const item of items) {
    if (item.kind === 'turn' || turns.length === 0) {
      turns.push([])
    }
    turns.at(-1)!.push(item)
  }
  return turns.map((turn, index) => (
    <section key={turn[0].key} className={styles.turn}>
      {renderItems(turn, context, index === turns.length - 1 ? items.at(-1) : undefined)}
      {index === turns.length - 1 && tail}
    </section>
  ))
}

function Timeline({ entries, context }: { entries: Entry[]; context: Context }) {
  const items = buildItems(entries, context)
  return renderItems(items, context, items.at(-1))
}

// last：整个对话的最后一项，正在进行的那一组步骤展开
function renderItems(items: Item[], context: Context, last: Item | undefined) {
  const { sessionId } = context
  return items.map((item) => {
    switch (item.kind) {
      case 'turn':
        return null
      case 'user':
        return (
          <div key={item.key} className={styles.user}>
            {item.text}
            <span className={styles.userMeta}>
              <time dateTime={item.time} title={formatFull(new Date(item.time))}>
                {formatClock(new Date(item.time))}
              </time>
              <CopyButton text={item.text} label="复制消息" />
            </span>
          </div>
        )
      case 'time':
        return (
          <div key={item.key} className={styles.time}>
            {formatDivider(new Date(item.time))}
          </div>
        )
      case 'attachments':
        return <AttachmentList key={item.key} sessionId={sessionId} attachments={item.attachments} />
      case 'text':
        return <Markdown key={item.key} sessionId={sessionId} text={item.text} files={item.files} />
      case 'steps':
        return <Steps key={item.key} steps={item.steps} context={context} last={item === last} />
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
        return <TurnEnd key={item.key} sessionId={sessionId} record={item.record} reply={item.reply} edits={item.edits} />
    }
  })
}

function StepView({ step, context }: { step: Step; context: Context }) {
  const { sessionId } = context
  switch (step.kind) {
    case 'thinking':
      return <Thinking sessionId={sessionId} text={step.text} durationMs={step.durationMs} />
    case 'tool':
      return <ToolCall sessionId={sessionId} call={step.call} now={context.now} />
    case 'agent': {
      const children = context.children.get(step.call.use.id)
      return (
        <AgentCall
          sessionId={sessionId}
          call={step.call}
          progress={context.live?.tasks[step.call.use.id]}
          now={context.now}
          timeline={children && <Timeline entries={children} context={context} />}
        />
      )
    }
  }
}

const categoryText: Record<ToolCategory, (count: number) => string> = {
  command: (n) => `运行 ${n} 条命令`,
  read: (n) => `查看 ${n} 个文件`,
  edit: (n) => `修改 ${n} 个文件`,
  search: (n) => `搜索 ${n} 次`,
  web: (n) => `打开 ${n} 个网页`,
  browser: (n) => `操作浏览器 ${n} 次`,
  agent: (n) => `启动 ${n} 个子 agent`,
  other: (n) => `调用 ${n} 次工具`,
}

// 一组步骤的摘要，比如「运行 3 条命令，查看 2 个文件」；修改的文件按路径去重
function summarize(steps: Step[]) {
  const counts = new Map<ToolCategory, Set<string>>()
  for (const step of steps) {
    if (step.kind === 'thinking') {
      continue
    }
    const category = toolKind(step.call.use.name).category
    const path = (step.call.use.input as { file_path?: unknown }).file_path
    const id = category === 'edit' && typeof path === 'string' ? path : step.call.use.id
    counts.set(category, (counts.get(category) ?? new Set()).add(id))
  }
  const parts = (Object.keys(categoryText) as ToolCategory[]).flatMap((category) => {
    const count = counts.get(category)?.size
    return count ? [categoryText[category](count)] : []
  })
  return parts.length ? parts.join('，') : `思考 ${steps.length} 次`
}

// 连续的几步：最多只有一次工具调用时直接显示；多次时收成一行「已工作 …」，正在进行的那一组展开，答完了收起，点开看每一步
function Steps({ steps, context, last }: { steps: Step[]; context: Context; last: boolean }) {
  const [userOpen, setUserOpen] = useState<boolean>()
  const calls = steps.flatMap((step) => (step.kind === 'thinking' ? [] : [step.call]))
  const list = steps.map((step) => <StepView key={step.key} step={step} context={context} />)
  if (calls.length <= 1) {
    return list
  }
  const running = calls.some((call) => callStatus(call) === 'running')
  const errors = calls.filter((call) => callStatus(call) === 'error').length
  const first = steps[0]
  const start = Date.parse(first.time) - (first.kind === 'thinking' ? (first.durationMs ?? 0) : 0)
  const end = Math.max(
    ...steps.map((step) => (step.kind === 'thinking' ? Date.parse(step.time) : step.call.result ? Date.parse(step.call.result.time) : running ? context.now : Date.parse(step.time))),
  )
  const open = userOpen ?? (context.live !== null && last)
  return (
    <div className={styles.worked} data-open={open || undefined}>
      <button type="button" className={styles.workedRow} onClick={() => setUserOpen(!open)} aria-expanded={open}>
        <span>
          {running ? '正在工作' : '已工作'} {formatDuration(Math.max(end - start, 0))} · {summarize(steps)}
          {errors > 0 && <span className={styles.errors}> · {errors} 个出错</span>}
        </span>
        <ChevronRight size={13} strokeWidth={2} className={styles.workedChevron} />
      </button>
      {open && <div className={styles.steps}>{list}</div>}
    </div>
  )
}

function compactText({ trigger, preTokens, postTokens }: Compact) {
  const sizes = preTokens !== undefined && postTokens !== undefined ? `（${formatTokens(preTokens)} → ${formatTokens(postTokens)} token）` : ''
  return `${trigger === 'manual' ? '手动' : '自动'}压缩了上下文${sizes}`
}

// 一轮的结尾：停止、出错，以及这一轮的统计
function TurnEnd({ sessionId, record, reply, edits }: { sessionId: number; record: Result; reply: string; edits: ToolCallItem[] }) {
  const files = fileChanges(edits)
  const { durationMs, outputTokens, context, model, outcome, error } = record
  const stats = [
    `用时 ${formatDuration(durationMs)}`,
    outputTokens !== undefined && `输出 ${formatTokens(outputTokens)} token`,
    context && `上下文 ${Math.round((context.tokens / context.window) * 100)}%`,
    model && formatModel(model),
  ].filter(Boolean)
  const changes = files.length > 0 && <TurnChanges sessionId={sessionId} files={files} />
  if (outcome === 'stopped') {
    return (
      <>
        {changes}
        <div className={styles.divider}>已停止 · {stats[0]}</div>
      </>
    )
  }
  return (
    <>
      {changes}
      {outcome === 'error' && <Alert>{error ?? 'agent 出错了'}</Alert>}
      <div className={styles.stats}>
        <span
          title={[`${formatFull(new Date(record.time))} 答完`, context && `上下文 ${context.tokens.toLocaleString()} / ${context.window.toLocaleString()} token`]
            .filter(Boolean)
            .join('\n')}
        >
          {[formatClock(new Date(record.time)), ...stats].join(' · ')}
        </span>
        {reply && <CopyButton text={reply} label="复制回复" />}
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
    <Turns
      entries={main}
      context={context}
      tail={
        <>
          {live?.thinking && <Thinking sessionId={sessionId} text={live.thinking} live />}
          {live?.text.trim() && <Markdown sessionId={sessionId} text={live.text} files={live.files} />}
          {live && (
            <div className={styles.status}>
              {statusText(live.status, live, runningTool?.type === 'tool_use' ? runningTool.name : undefined)}
              {turnStart && ` · ${formatElapsed(now - Date.parse(turnStart))}`}
            </div>
          )}
        </>
      }
    />
  )
}

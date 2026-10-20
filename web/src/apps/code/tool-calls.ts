import type { TranscriptRecord } from '@binos/server/apps/code/types'
import { diffLines } from 'diff'
import { AppWindow, Bot, FilePen, FilePlus, FileText, Globe, Image, ListTodo, PackageSearch, Search, Sparkles, SquareTerminal, Wrench } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type ToolUse = Extract<TranscriptRecord, { type: 'tool_use' }>
export type ToolResult = Extract<TranscriptRecord, { type: 'tool_result' }>
// live：这一轮还在回答，没有结果的调用还在运行
export type ToolCallItem = { use: ToolUse; result: ToolResult | undefined; live: boolean }

export type CallStatus = 'running' | 'done' | 'error' | 'stopped'

export function callStatus({ result, live }: ToolCallItem): CallStatus {
  return result ? result.status : live ? 'running' : 'stopped'
}

// 结束了的是调用到结果的时间，还在运行的是到现在的时间
export function callDuration({ use, result, live }: ToolCallItem, now: number): number | undefined {
  if (result) {
    return Date.parse(result.time) - Date.parse(use.time)
  }
  return live ? Math.max(now - Date.parse(use.time), 0) : undefined
}

// 分组摘要里按这些类别计数
export type ToolCategory = 'command' | 'read' | 'edit' | 'search' | 'web' | 'browser' | 'agent' | 'other'

type ToolKind = { icon: LucideIcon; verb: string; category: ToolCategory; detailKey?: string }

const kinds: Record<string, ToolKind> = {
  Bash: { icon: SquareTerminal, verb: '运行', category: 'command', detailKey: 'command' },
  Read: { icon: FileText, verb: '查看', category: 'read', detailKey: 'file_path' },
  Write: { icon: FilePlus, verb: '写入', category: 'edit', detailKey: 'file_path' },
  Edit: { icon: FilePen, verb: '修改', category: 'edit', detailKey: 'file_path' },
  NotebookEdit: { icon: FilePen, verb: '修改', category: 'edit', detailKey: 'notebook_path' },
  // 按 diff 改文件，每个文件一次
  Patch: { icon: FilePen, verb: '修改', category: 'edit', detailKey: 'file_path' },
  ViewImage: { icon: Image, verb: '查看图片', category: 'read', detailKey: 'file_path' },
  Grep: { icon: Search, verb: '搜索', category: 'search', detailKey: 'pattern' },
  Glob: { icon: Search, verb: '查找文件', category: 'search', detailKey: 'pattern' },
  WebSearch: { icon: Globe, verb: '搜索网页', category: 'search', detailKey: 'query' },
  WebFetch: { icon: Globe, verb: '打开网页', category: 'web', detailKey: 'url' },
  ToolSearch: { icon: PackageSearch, verb: '加载工具', category: 'other', detailKey: 'query' },
  Skill: { icon: Sparkles, verb: '使用技能', category: 'other', detailKey: 'skill' },
  TodoWrite: { icon: ListTodo, verb: '更新待办', category: 'other' },
  Agent: { icon: Bot, verb: '子 agent', category: 'agent', detailKey: 'description' },
  Task: { icon: Bot, verb: '子 agent', category: 'agent', detailKey: 'description' },
}

// Chrome 浏览器的工具，没列出的直接用工具名
const browserVerbs: Record<string, [verb: string, detailKey?: string]> = {
  navigate: ['浏览器打开', 'url'],
  computer: ['操作浏览器', 'action'],
  browser_batch: ['操作浏览器'],
  javascript_tool: ['在浏览器里执行脚本', 'text'],
  read_page: ['读取页面'],
  get_page_text: ['读取页面'],
  find: ['在页面里查找', 'query'],
  form_input: ['填写表单'],
  read_console_messages: ['查看控制台', 'pattern'],
  read_network_requests: ['查看网络请求'],
  tabs_context_mcp: ['查看标签页'],
  tabs_create_mcp: ['新建标签页'],
  tabs_close_mcp: ['关闭标签页'],
}

export function toolKind(name: string): ToolKind {
  if (name.startsWith('mcp__claude-in-chrome__')) {
    const tool = name.slice('mcp__claude-in-chrome__'.length)
    const [verb, detailKey] = browserVerbs[tool] ?? [`浏览器 ${tool}`]
    return { icon: AppWindow, verb, category: 'browser', detailKey }
  }
  return kinds[name] ?? { icon: Wrench, verb: name.replace(/^mcp__/, '').replaceAll('__', ' '), category: 'other' }
}

// 修改和写入文件增删了多少行
export function lineChanges(use: ToolUse): { added: number; removed: number } | undefined {
  const input = use.input as { old_string?: unknown; new_string?: unknown; content?: unknown }
  if (use.name === 'Edit' && typeof input.old_string === 'string' && typeof input.new_string === 'string') {
    let added = 0
    let removed = 0
    for (const part of diffLines(input.old_string, input.new_string)) {
      if (part.added) {
        added += part.count ?? 0
      } else if (part.removed) {
        removed += part.count ?? 0
      }
    }
    return { added, removed }
  }
  if (use.name === 'Patch') {
    return patchChanges(use.input as { kind?: unknown; diff?: unknown })
  }
  if (use.name === 'Write' && typeof input.content === 'string') {
    return { added: input.content.replace(/\n$/, '').split('\n').length, removed: 0 }
  }
  return undefined
}

// Patch 改文件：新建和删除时 diff 是整个文件的内容，修改时是统一格式的 diff
function patchChanges({ kind, diff }: { kind?: unknown; diff?: unknown }): { added: number; removed: number } | undefined {
  if (typeof diff !== 'string') {
    return undefined
  }
  const lines = diff.replace(/\n$/, '').split('\n')
  if (kind === 'add' || kind === 'delete') {
    const count = diff ? lines.length : 0
    return kind === 'add' ? { added: count, removed: 0 } : { added: 0, removed: count }
  }
  const body = lines.filter((line) => !line.startsWith('+++') && !line.startsWith('---'))
  return { added: body.filter((line) => line.startsWith('+')).length, removed: body.filter((line) => line.startsWith('-')).length }
}

// 一轮里改过的一个文件：增删的行数合计，以及改它的每一次调用。kind 是 Patch 新建或删除了它
export type FileChange = { path: string; added: number; removed: number; kind?: 'add' | 'delete'; calls: ToolCallItem[] }

const editTools = new Set(['Edit', 'Write', 'NotebookEdit', 'Patch'])

export const isFileEdit = (use: ToolUse) => editTools.has(use.name)

// 成功的修改按文件合并，顺序是第一次改它的顺序
export function fileChanges(calls: ToolCallItem[]): FileChange[] {
  const files = new Map<string, FileChange>()
  for (const call of calls) {
    const input = call.use.input as { file_path?: unknown; notebook_path?: unknown; kind?: unknown }
    const path = input.file_path ?? input.notebook_path
    if (call.result?.status !== 'done' || typeof path !== 'string') {
      continue
    }
    const file = files.get(path) ?? { path, added: 0, removed: 0, calls: [] }
    const changes = lineChanges(call.use)
    file.added += changes?.added ?? 0
    file.removed += changes?.removed ?? 0
    if (input.kind === 'add' || input.kind === 'delete') {
      file.kind = input.kind
    }
    file.calls.push(call)
    files.set(path, file)
  }
  return [...files.values()]
}

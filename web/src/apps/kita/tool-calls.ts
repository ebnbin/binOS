import type { TranscriptRecord } from '@binos/server/apps/kita/types'
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

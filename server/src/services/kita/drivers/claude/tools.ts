import type { ToolDetail } from '../../types.js'
import { mcpTool } from '../tools.js'

const text = (value: unknown) => (typeof value === 'string' ? value : '')

// Claude Code 的工具调用归类。参数都已经在 tool 里的，不再带原始的 input
export function claudeTool(name: string, input: Record<string, unknown>): { tool: ToolDetail; input?: unknown } {
  switch (name) {
    case 'Bash':
      return { tool: { kind: 'command', command: text(input.command) } }
    case 'Read':
      return { tool: { kind: 'read', path: text(input.file_path) } }
    case 'Write':
      return { tool: { kind: 'edit', path: text(input.file_path), change: { type: 'write', content: text(input.content) } } }
    case 'Edit':
      return {
        tool: {
          kind: 'edit',
          path: text(input.file_path),
          change: { type: 'replace', before: text(input.old_string), after: text(input.new_string), ...(input.replace_all === true && { all: true }) },
        },
      }
    case 'NotebookEdit':
      return { tool: { kind: 'edit', path: text(input.notebook_path) }, input }
    case 'Grep':
      return { tool: { kind: 'search', pattern: text(input.pattern), target: 'content' } }
    case 'Glob':
      return { tool: { kind: 'search', pattern: text(input.pattern), target: 'files' } }
    case 'WebSearch':
      return { tool: { kind: 'web_search', query: text(input.query) } }
    case 'WebFetch':
      return { tool: { kind: 'web_fetch', url: text(input.url), ...(typeof input.prompt === 'string' && { prompt: input.prompt }) } }
    case 'ToolSearch':
      return { tool: { kind: 'tool_search', query: text(input.query) } }
    case 'Skill':
      return { tool: { kind: 'skill', name: text(input.skill) } }
    case 'TodoWrite':
      return { tool: { kind: 'todo' }, input }
    case 'Agent':
    case 'Task':
      return {
        tool: {
          kind: 'subagent',
          description: text(input.description),
          ...(typeof input.prompt === 'string' && { prompt: input.prompt }),
          ...(typeof input.subagent_type === 'string' && { type: input.subagent_type }),
        },
      }
  }
  // MCP 工具的名字是 mcp__服务__工具
  const mcp = /^mcp__(.+?)__(.+)$/.exec(name)
  if (mcp) {
    return mcpTool(mcp[1], mcp[2], input)
  }
  return { tool: { kind: 'other' }, input }
}

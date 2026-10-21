import type { Entry } from '@binos/server/services/kita/types'
import type { ToolCall, ToolResult } from './tools.ts'

export type IndexedEntry = { item: Entry; index: number }

// vendor 的调用 id 只在当前轮内匹配；渲染时用调用对象关联结果和子条目。
export function indexTranscript(items: Entry[]) {
  const results = new Map<ToolCall, ToolResult>()
  const children = new Map<ToolCall, IndexedEntry[]>()
  const main: IndexedEntry[] = []
  let turn: IndexedEntry[] = []
  const flush = () => {
    const calls = new Map(turn.flatMap(({ item }) => item.type === 'tool_call' ? [[item.id, item] as const] : []))
    for (const entry of turn) {
      const { item } = entry
      if (item.type === 'tool_result') {
        const call = calls.get(item.callId)
        if (call) results.set(call, item)
      }
      const parent = 'parent' in item && item.parent ? calls.get(item.parent) : undefined
      if (parent) {
        const siblings = children.get(parent) ?? []
        siblings.push(entry)
        children.set(parent, siblings)
      } else {
        main.push(entry)
      }
    }
    turn = []
  }
  items.forEach((item, index) => {
    if (item.type === 'input' && item.mode === 'start') flush()
    turn.push({ item, index })
  })
  flush()
  return { results, children, main }
}

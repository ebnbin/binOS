import type { Entry } from '@binos/server/services/kita/types'
import type { ToolCall, ToolResult } from './tools.ts'

export type IndexedEntry = { item: Entry; index: number }

// 一轮：从 mode 为 start 的 input 到下一个之前，第一轮之前的条目单独成一组。
// vendor 的调用 id 只在当前轮内匹配；渲染时用调用对象关联结果和子条目
export type Turn = {
  first: Entry
  start: number
  size: number
  main: IndexedEntry[]
  results: Map<ToolCall, ToolResult>
  children: Map<ToolCall, IndexedEntry[]>
}

function indexTurn(items: Entry[], start: number, end: number): Turn {
  const entries = items.slice(start, end).map((item, offset) => ({ item, index: start + offset }))
  const calls = new Map(entries.flatMap(({ item }) => item.type === 'tool_call' ? [[item.id, item] as const] : []))
  const results = new Map<ToolCall, ToolResult>()
  const children = new Map<ToolCall, IndexedEntry[]>()
  const main: IndexedEntry[] = []
  for (const entry of entries) {
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
  return { first: items[start], start, size: end - start, main, results, children }
}

// 条目只会追加：和 previous 里同一段条目的轮沿用原来的对象，页面上这些轮可以跳过重新渲染
export function splitTurns(items: Entry[], previous: Turn[] = []): Turn[] {
  const starts = items.flatMap((item, index) => (index === 0 || (item.type === 'input' && item.mode === 'start') ? [index] : []))
  return starts.map((start, i) => {
    const end = starts[i + 1] ?? items.length
    const old = previous[i]
    return old?.first === items[start] && old.start === start && old.size === end - start ? old : indexTurn(items, start, end)
  })
}

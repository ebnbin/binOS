import type { TranscriptRecord } from '@binos/server/apps/agent/types'

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

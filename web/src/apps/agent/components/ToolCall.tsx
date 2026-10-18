import { formatDuration } from '../format.ts'
import { callDuration, callStatus, toolKind } from '../tool-calls.ts'
import type { ToolCallItem } from '../tool-calls.ts'
import { Activity } from './Activity.tsx'
import { ToolBody } from './ToolBody.tsx'

// 文件路径太长时只留后面几段
function shorten(text: string) {
  if (!text.startsWith('/') || text.length <= 48) {
    return text
  }
  const parts = text.split('/')
  return `…/${parts.slice(-3).join('/')}`
}

function toolDetail(name: string, input: Record<string, unknown>): string {
  const key = toolKind(name).detailKey
  const value = key ? input[key] : Object.values(input).find((v) => typeof v === 'string')
  return typeof value === 'string' ? shorten(value) : ''
}

export function ToolCall({ sessionId, call, now }: { sessionId: number; call: ToolCallItem; now: number }) {
  const { use, result } = call
  const { icon: Icon, verb } = toolKind(use.name)
  const duration = callDuration(call, now)
  const meta = [use.background && '后台', duration !== undefined && formatDuration(duration)].filter(Boolean).join(' · ')
  return (
    <Activity
      icon={<Icon size={14} strokeWidth={1.75} />}
      label={verb}
      detail={toolDetail(use.name, use.input as Record<string, unknown>)}
      meta={meta}
      status={callStatus(call)}
      body={() => <ToolBody sessionId={sessionId} use={use} result={result} />}
    />
  )
}

import { diffLines } from 'diff'
import { formatDuration } from '../format.ts'
import { callDuration, callStatus, toolKind } from '../tool-calls.ts'
import type { ToolCallItem, ToolUse } from '../tool-calls.ts'
import { Activity } from './Activity.tsx'
import styles from './ToolCall.module.css'
import { ToolBody } from './ToolBody.tsx'

// 收起时显示的输出行数
const previewLines = 2
// Claude Code 在命令输出后面附加的说明，不是命令本身的输出
const harnessNote = /^Shell cwd was reset to /

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

// 修改和写入文件增删了多少行
function lineChanges(use: ToolUse): { added: number; removed: number } | undefined {
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
  if (use.name === 'Write' && typeof input.content === 'string') {
    return { added: input.content.replace(/\n$/, '').split('\n').length, removed: 0 }
  }
  return undefined
}

// 命令的输出、以及出错的工具的报错，收起时显示最后几行
function preview(call: ToolCallItem): string | undefined {
  const { use, result } = call
  if (!result?.output || (use.name !== 'Bash' && result.status !== 'error')) {
    return undefined
  }
  const lines = result.output.split('\n').filter((line) => line.trim() && !harnessNote.test(line))
  return lines.slice(-previewLines).join('\n') || undefined
}

export function ToolCall({ sessionId, call, now }: { sessionId: number; call: ToolCallItem; now: number }) {
  const { use, result } = call
  const duration = callDuration(call, now)
  const changes = lineChanges(use)
  return (
    <Activity
      label={toolKind(use.name).verb}
      detail={toolDetail(use.name, use.input as Record<string, unknown>)}
      meta={
        <>
          {changes && changes.added > 0 && <span className={styles.added}>+{changes.added}</span>}
          {changes && changes.removed > 0 && <span className={styles.removed}>−{changes.removed}</span>}
          {use.background && <span>后台</span>}
          {duration !== undefined && <span>{formatDuration(duration)}</span>}
        </>
      }
      preview={preview(call)}
      status={callStatus(call)}
      body={() => <ToolBody sessionId={sessionId} use={use} result={result} />}
    />
  )
}

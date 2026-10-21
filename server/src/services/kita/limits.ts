import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { notifyChange } from '../../events.js'
import { kitaServiceDir } from '../../paths.js'
import type { AgentId, Limits } from './types.js'

// 订阅额度是整个账号的，不属于哪个会话：每个 agent 记下最近一次报告的，后端重启后照样能显示。
// 只有这个后端写这个文件，启动后以内存里的为准
const limitsPath = path.join(kitaServiceDir, 'limits.json')

let saved: Partial<Record<AgentId, Limits>> | undefined

// 读不懂的项不用，等 agent 下次报告
export function allLimits(): Partial<Record<AgentId, Limits>> {
  if (!saved) {
    try {
      const stored = JSON.parse(readFileSync(limitsPath, 'utf8')) as Record<string, Partial<Limits>>
      saved = Object.fromEntries(Object.entries(stored).filter(([, limits]) => Array.isArray(limits.windows)))
    } catch {
      saved = {}
    }
  }
  return saved!
}

// 报告的可能只有变了的窗口：按 id 并进之前的，窗口按长短排。先写临时文件再改名，不会出现写了一半的文件。写好后通知页面
export function saveLimits(agent: AgentId, limits: Limits) {
  const reported = new Set(limits.windows.map((window) => window.id))
  const windows = [...(allLimits()[agent]?.windows ?? []).filter((window) => !reported.has(window.id)), ...limits.windows].sort(
    (a, b) => a.minutes - b.minutes,
  )
  saved = { ...allLimits(), [agent]: { ...limits, windows } }
  mkdirSync(kitaServiceDir, { recursive: true })
  writeFileSync(`${limitsPath}.tmp`, JSON.stringify(saved, null, 2) + '\n')
  renameSync(`${limitsPath}.tmp`, limitsPath)
  notifyChange({ type: 'agent' })
}

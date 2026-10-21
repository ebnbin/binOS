import { activeAccount } from './drivers/claude/accounts.js'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { notifyChange } from '../../events.js'
import { agentServiceDir } from '../../paths.js'
import type { AgentId, Limits } from './types.js'

// 订阅额度按账号保存，旧版 Claude 的记录归主账号；页面显示当前选中账号的额度。
// 只有这个后端写这个文件，启动后以内存里的为准
const limitsPath = path.join(agentServiceDir, 'limits.json')

let saved: Record<string, Limits> | undefined

// 读不懂的项不用，等 agent 下次报告
function storedLimits(): Record<string, Limits> {
  if (!saved) {
    try {
      const stored = JSON.parse(readFileSync(limitsPath, 'utf8')) as Record<string, Limits>
      saved = Object.fromEntries(Object.entries(stored).filter(([, limits]) => Array.isArray(limits.windows)))
    } catch {
      saved = {}
    }
  }
  return saved!
}

export function allLimits(): Partial<Record<AgentId, Limits>> {
  const saved = storedLimits()
  const account = activeAccount()
  const key = account === 'main' ? 'claude' : `claude:${account}`
  return { ...(saved.codex && { codex: saved.codex }), ...(saved[key] && { claude: saved[key] }) }
}

// 报告可能只有变了的窗口，按 id 合并；以原子写入保存后通知页面。
export function saveLimits(agent: AgentId, limits: Limits, account = 'main') {
  const key = agent === 'claude' && account !== 'main' ? `claude:${account}` : agent
  const reported = new Set(limits.windows.map((window) => window.id))
  const windows = [...(storedLimits()[key]?.windows ?? []).filter((window) => !reported.has(window.id)), ...limits.windows].sort(
    (a, b) => a.minutes - b.minutes,
  )
  saved = { ...storedLimits(), [key]: { ...limits, windows } }
  mkdirSync(agentServiceDir, { recursive: true })
  writeFileSync(`${limitsPath}.tmp`, JSON.stringify(saved, null, 2) + '\n')
  renameSync(`${limitsPath}.tmp`, limitsPath)
  notifyChange({ type: 'agent' })
}

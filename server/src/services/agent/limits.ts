import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { notifyChange } from '../../events.js'
import { agentServiceDir } from '../../paths.js'
import { drivers } from './drivers/index.js'
import type { AgentId, Limits } from './types.js'

// 订阅额度是整个账号的，不属于哪个会话：每个 agent 记下最近一次报告的，后端重启后照样能显示。
// 只有这个后端写这个文件，启动后以内存里的为准
const limitsPath = path.join(agentServiceDir, 'limits.json')

let saved: Partial<Record<AgentId, Limits>> | undefined

export function allLimits(): Partial<Record<AgentId, Limits>> {
  if (!saved) {
    try {
      saved = JSON.parse(readFileSync(limitsPath, 'utf8')) as Partial<Record<AgentId, Limits>>
    } catch {
      saved = {}
    }
  }
  return saved
}

// 先写临时文件再改名，不会出现写了一半的文件。写好后通知页面
export function saveLimits(agent: AgentId, limits: Limits) {
  const current = allLimits()[agent]
  const merged = drivers[agent].partialLimits ? { ...current, ...limits } : limits
  saved = { ...allLimits(), [agent]: merged }
  mkdirSync(agentServiceDir, { recursive: true })
  writeFileSync(`${limitsPath}.tmp`, JSON.stringify(saved, null, 2) + '\n')
  renameSync(`${limitsPath}.tmp`, limitsPath)
  notifyChange({ type: 'agent' })
}

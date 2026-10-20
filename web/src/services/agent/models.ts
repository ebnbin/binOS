import type { AgentCatalog } from '@binos/server/services/agent/types'
import { useEffect, useState } from 'react'
import { agentCatalogs } from './api.ts'

const effortNames: Record<string, string> = { minimal: '最低', low: '低', medium: '中', high: '高', xhigh: '很高', max: '最高', ultra: '极高' }

export const effortName = (effort: string) => effortNames[effort] ?? effort

// 各个 agent 能不能用、有哪些模型；页面打开期间只问一次
let catalogs: Promise<AgentCatalog[]> | undefined

export function useAgentCatalogs(): AgentCatalog[] {
  const [result, setResult] = useState<AgentCatalog[]>([])
  useEffect(() => {
    catalogs ??= agentCatalogs()
    let active = true
    void catalogs.then((value) => active && setResult(value))
    return () => {
      active = false
    }
  }, [])
  return result
}

// claude-opus-5-5 → Opus 5.5；gpt-6.1-sol → GPT-6.1-Sol
export function formatModel(model: string) {
  if (model.startsWith('gpt-')) {
    return model.split('-').map((part, i) => (i === 0 ? 'GPT' : part[0].toUpperCase() + part.slice(1))).join('-')
  }
  const match = /^claude-([a-z]+)-(\d+)(?:-(\d+))?/.exec(model)
  if (!match) {
    return model
  }
  const [, family, major, minor] = match
  return `${family[0].toUpperCase()}${family.slice(1)} ${minor ? `${major}.${minor}` : major}`
}

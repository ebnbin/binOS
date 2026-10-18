import type { CodexModel, Provider } from '@binos/server/apps/agent/types'
import { useEffect, useState } from 'react'
import { codexCatalog } from './api.ts'

export const providerNames: Record<Provider, string> = { claude: 'Claude', codex: 'Codex' }

export const claudeModelNames: Record<string, string> = { fable: 'Fable', opus: 'Opus', sonnet: 'Sonnet', haiku: 'Haiku' }

const effortNames: Record<string, string> = { minimal: '最低', low: '低', medium: '中', high: '高', xhigh: '很高', max: '最高', ultra: '极高' }

export const effortName = (effort: string) => effortNames[effort] ?? effort

// Codex 能不能用、有哪些模型；页面打开期间只问一次
let catalog: Promise<{ available: boolean; models: CodexModel[] }> | undefined

export function useCodexCatalog() {
  const [result, setResult] = useState<{ available: boolean; models: CodexModel[] }>({ available: false, models: [] })
  useEffect(() => {
    catalog ??= codexCatalog()
    let active = true
    void catalog.then((value) => active && setResult(value))
    return () => {
      active = false
    }
  }, [])
  return result
}

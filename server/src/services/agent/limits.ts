import { applyChanges, readState } from '../../state.js'
import { adapters } from './adapters.js'
import { agents } from './types.js'
import type { Limits, Provider } from './types.js'

// 额度变了才写进系统状态，各个页面随即收到
export function saveLimits(provider: Provider, limits: Limits) {
  const key = agents[provider].limitsKey
  const current = readState().entries.find((entry) => entry.key === key)?.value as Limits | undefined
  const merged = adapters[provider].partialLimits ? { ...current, ...limits } : limits
  const { updatedAt: _, ...next } = merged
  const { updatedAt: __, ...previous } = current ?? {}
  if (JSON.stringify(next) !== JSON.stringify(previous)) {
    applyChanges([{ key, value: merged }])
  }
}

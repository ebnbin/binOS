import { adapters, agentEnv } from './adapters.js'
import { runningCount } from './runs.js'
import { providers } from './types.js'
import type { AgentAccount, AgentCatalog } from './types.js'

export function agentAccounts(): Promise<AgentAccount[]> {
  return Promise.all(
    providers.map(async (provider) => ({ provider, ...(await adapters[provider].account(agentEnv(provider))), running: runningCount(provider) })),
  )
}

export function agentCatalogs(): Promise<AgentCatalog[]> {
  return Promise.all(providers.map(async (provider) => ({ provider, ...(await adapters[provider].catalog(agentEnv(provider))) })))
}

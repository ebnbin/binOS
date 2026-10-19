import { adapters } from './adapters.js'
import { runningCount } from './runs.js'
import { providers } from './types.js'
import type { AgentAccount } from './types.js'

export function agentAccounts(): Promise<AgentAccount[]> {
  return Promise.all(providers.map(async (provider) => ({ provider, ...(await adapters[provider].account()), running: runningCount(provider) })))
}

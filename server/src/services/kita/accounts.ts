import { agentEnv, drivers } from './drivers/index.js'
import { runningCount } from './sessions.js'
import { agentIds } from './types.js'
import type { AgentAccount, AgentCatalog } from './types.js'

export function agentAccounts(): Promise<AgentAccount[]> {
  return Promise.all(agentIds.map(async (agent) => ({ agent, ...(await drivers[agent].account(agentEnv(agent))), running: runningCount(agent) })))
}

export function agentCatalogs(): Promise<AgentCatalog[]> {
  return Promise.all(agentIds.map(async (agent) => ({ agent, ...(await drivers[agent].catalog(agentEnv(agent))) })))
}

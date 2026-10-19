import { Hono } from 'hono'
import { agentAccounts, agentCatalogs } from './accounts.js'

// 页面用到的 agent 服务：系统 app 显示账号，app 里选 agent 和模型
export const agentApi = new Hono()
  // 各个 agent 的账号、登录凭证和用量
  .get('/accounts', async (c) => c.json({ accounts: await agentAccounts() }))
  // 各个 agent 能不能用、有哪些模型
  .get('/agents', async (c) => c.json({ agents: await agentCatalogs() }))

export type AgentApi = typeof agentApi

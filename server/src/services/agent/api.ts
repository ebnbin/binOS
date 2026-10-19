import { Hono } from 'hono'
import { agentAccounts } from './accounts.js'
import { codexCatalog } from './codex/app-server.js'
import { saveLimits } from './limits.js'

// 页面用到的 agent 服务：系统 app 显示账号，app 里选 agent 和模型
export const agentApi = new Hono()
  // 各个 agent 的账号、登录凭证和用量
  .get('/accounts', async (c) => c.json({ accounts: await agentAccounts() }))
  // Codex 能不能用、有哪些模型；顺便更新 Codex 的额度
  .get('/codex', async (c) => {
    const { limits, ...catalog } = await codexCatalog()
    if (limits) {
      saveLimits('codex', limits)
    }
    return c.json(catalog)
  })

export type AgentApi = typeof agentApi

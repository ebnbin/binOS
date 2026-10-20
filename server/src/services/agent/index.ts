import { claudeAuth } from './drivers/claude/auth.js'
import { codexAuth } from './drivers/codex/auth.js'
import { startThreads } from './threads.js'

// agent 服务：任何 app 都可以建 thread，和 agent 对话。agent 进程由服务管理，app 只管说话、停下、看内容
export { allLimits } from './limits.js'
export { createThread, getThread, onThreadEvent } from './threads.js'
export type { SendOptions, Thread, ThreadInput, ThreadOptions } from './threads.js'

// 登录会随时间到期（比如快到期时自动换成备用 token），定时看一遍，变了就通知页面
const authCheckInterval = 3600_000

export function startAgentService() {
  const check = () => {
    claudeAuth()
    codexAuth()
  }
  check()
  setInterval(check, authCheckInterval).unref()
  startThreads()
}

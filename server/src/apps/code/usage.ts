import { readState } from '../../state.js'
import { agents } from '../../services/agent/types.js'
import type { Limits, Tokens } from '../../services/agent/types.js'
import { addUsage, sessionInfo } from './sessions.js'

const week = 7 * 86_400_000
// 7 天窗口用得太少时估不准
const minUtilization = 0.2

// 订阅额度怎么算没有公开，只知道 7 天窗口用了百分之几。把这个窗口里 binOS 的 Claude 每一轮的花费（按 API 价格折算）加起来，
// 除以用了的比例，就是一周额度用满大约值多少；会话的花费除以它，就是会话大约占了周额度多少。
// 同一个订阅在别处（claude.ai、自己终端里的 Claude）也在用时，估出来的一周额度偏小，会话占的比例偏高。估不了时没有
export function weeklyBudget(ids: number[], now = Date.now()): number | undefined {
  const limits = readState().entries.find((entry) => entry.key === agents.claude.limitsKey)?.value as Limits | undefined
  const window = limits?.sevenDay
  if (!window || window.resetsAt * 1000 <= now || window.utilization < minUtilization) {
    return undefined
  }
  const start = window.resetsAt * 1000 - week
  let spent = 0
  for (const id of ids) {
    for (const [time, cost] of sessionInfo(id).costs) {
      if (Date.parse(time) >= start) {
        spent += cost
      }
    }
  }
  return spent > 0 ? spent / window.utilization : undefined
}

// 会话一共用掉的 token（各个模型加在一起），和它大约占周额度多少
export function sessionUsage(id: number, budget: number | undefined): { tokens?: Tokens; quota?: number } {
  const info = sessionInfo(id)
  const models = Object.values(addUsage(info.usageBefore, info.usageLatest))
  const total = models.reduce(
    (sum, value) => ({
      input: sum.input + value.input,
      output: sum.output + value.output,
      cacheRead: sum.cacheRead + value.cacheRead,
      cacheWrite: sum.cacheWrite + value.cacheWrite,
    }),
    { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  )
  const cost = info.costs.reduce((sum, [, value]) => sum + value, 0)
  return {
    ...(models.length > 0 && { tokens: total }),
    ...(budget && cost > 0 && { quota: cost / budget }),
  }
}

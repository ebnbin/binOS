import { appendFileSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { allLimits, isPriced } from '../../services/kita/index.js'
import { agentIds } from '../../services/kita/types.js'
import type { Tokens } from '../../services/kita/types.js'
import { dataDir, listSessions, threadOf } from './sessions.js'
import type { CodeUsage } from './types.js'

// 会话大约占订阅周额度多少，只有能按 API 价格折算花费（thread 有 costs）的 agent 估得出来，这里的点都是它的。
// 额度怎么算没有公开，只知道 7 天窗口用了百分之几（精确到 1%），而且这个窗口是整个订阅共用的：
// agent 自己的 app、网页版、别的应用也在用。binOS 能知道的只有自己每一轮按 API 价格折算的花费。
// 每次它的一轮结束时记一个点：当时 7 天窗口的用量和 binOS 到这时为止一共花了多少。同一个窗口里任取两个点，
// 窗口涨的不会少于 binOS 这段时间花的折算成的用量（别处只会让它多涨），所以「涨幅 ÷ 花费」的最小值就是每美元占周额度多少的估计：
// 有过只有 binOS 在用的一段时间，估得就准；别处一直在用时偏高。会话的花费乘以它就是会话占的比例
const samplesPath = path.join(dataDir, 'quota-samples.jsonl')

export type Sample = { time: string; resetsAt: number; utilization: number; cost: number }

// 窗口用量只精确到 1%：涨幅按多算 1% 算，涨得太少的区间不用
const precision = 0.01
const minRise = 0.03

const pricedAgent = agentIds.find(isPriced)
const weekMinutes = 7 * 24 * 60

const sessionCosts = (id: number) => threadOf(id).summary().costs
const totalCost = () => listSessions().reduce((sum, id) => sum + sessionCosts(id).reduce((s, [, cost]) => s + cost, 0), 0)

function weekWindow(now: number) {
  const window = pricedAgent && allLimits()[pricedAgent]?.windows.find((item) => item.minutes === weekMinutes)
  return window && window.resetsAt * 1000 > now ? window : undefined
}

function readSamples(): Sample[] {
  try {
    return readFileSync(samplesPath, 'utf8')
      .split('\n')
      .flatMap((line) => {
        try {
          return [JSON.parse(line) as Sample]
        } catch {
          return []
        }
      })
  } catch {
    return []
  }
}

// 每美元占周额度多少：同一个窗口里任两个点之间「涨幅 ÷ 花费」的最小值。还没有涨够的区间时没有
export function estimateRate(samples: Sample[]): number | undefined {
  let rate: number | undefined
  for (const window of Map.groupBy(samples, (sample) => sample.resetsAt).values()) {
    for (let i = 0; i < window.length; i++) {
      for (let j = i + 1; j < window.length; j++) {
        const rise = window[j].utilization - window[i].utilization
        const spent = window[j].cost - window[i].cost
        if (rise >= minRise && spent > 0) {
          rate = Math.min(rate ?? Infinity, (rise + precision) / spent)
        }
      }
    }
  }
  return rate
}

let cached: { size: number; rate: number | undefined } | undefined
function quotaRate(): number | undefined {
  let size = 0
  try {
    size = statSync(samplesPath).size
  } catch {
    return undefined
  }
  if (cached?.size === size) {
    return cached.rate
  }
  const rate = estimateRate(readSamples())
  cached = { size, rate }
  return rate
}

// 能折算花费的 agent 的一轮结束了：记一个点
export function recordQuotaSample(now = Date.now()) {
  const week = weekWindow(now)
  if (!week) {
    return
  }
  const sample: Sample = { time: new Date(now).toISOString(), resetsAt: week.resetsAt, utilization: week.utilization, cost: totalCost() }
  const last = readSamples().at(-1)
  if (!last || last.resetsAt !== sample.resetsAt || last.utilization !== sample.utilization || last.cost !== sample.cost) {
    appendFileSync(samplesPath, JSON.stringify(sample) + '\n')
  }
}

// 当前这个 7 天窗口里 binOS 大约用了周额度的多少；没有能折算花费的 agent 的额度或者窗口已经过了时没有
export function codeUsage(now = Date.now()): CodeUsage | undefined {
  const week = weekWindow(now)
  if (!week) {
    return undefined
  }
  const rate = quotaRate()
  if (rate === undefined) {
    return { resetsAt: week.resetsAt }
  }
  const start = week.resetsAt * 1000 - 7 * 86_400_000
  const spent = listSessions().reduce(
    (sum, id) => sum + sessionCosts(id).reduce((s, [time, cost]) => (Date.parse(time) >= start ? s + cost : s), 0),
    0,
  )
  return { resetsAt: week.resetsAt, week: Math.min(spent * rate, week.utilization) }
}

// 会话一共用掉的 token（各个模型加在一起），和它大约占周额度多少
export function sessionUsage(id: number): { tokens?: Tokens; quota?: number } {
  const { usage, costs } = threadOf(id).summary()
  const models = Object.values(usage)
  const total = models.reduce(
    (sum, value) => ({
      input: sum.input + value.input,
      output: sum.output + value.output,
      cacheRead: sum.cacheRead + value.cacheRead,
      cacheWrite: sum.cacheWrite + value.cacheWrite,
    }),
    { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  )
  const cost = costs.reduce((sum, [, value]) => sum + value, 0)
  const rate = quotaRate()
  return {
    ...(models.length > 0 && { tokens: total }),
    ...(rate !== undefined && cost > 0 && { quota: cost * rate }),
  }
}

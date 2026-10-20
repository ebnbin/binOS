import type { Tokens } from '../../types.js'

// 每百万 token 的 API 价格（美元）：输入、输出、读缓存、写缓存。按模型名里的字样认，都不认识时按 Opus 算。
// 订阅不按这个收费，这里只用来把不同模型、不同种类的 token 折算到一起比大小，相对价格对就行。
// 写缓存有 5 分钟（输入价的 1.25 倍）和 1 小时（2 倍）两种，记录里分不开，按 5 分钟的算
const prices: [pattern: RegExp, price: Tokens][] = [
  [/fable|mythos/, { input: 10, output: 50, cacheRead: 0.25, cacheWrite: 12.5 }],
  [/opus/, { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 }],
  [/sonnet/, { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 }],
  [/haiku/, { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 }],
]

export function tokenCost(model: string, tokens: Tokens): number {
  const price = prices.find(([pattern]) => pattern.test(model))?.[1] ?? prices[1][1]
  return (
    (tokens.input * price.input + tokens.output * price.output + tokens.cacheRead * price.cacheRead + tokens.cacheWrite * price.cacheWrite) / 1e6
  )
}

import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { codexHome } from '../../../paths.js'
import type { CodexModel, Limits } from '../types.js'

// 新对话能不能选 Codex、能选哪些模型：codex 没装或没登录时 available 为 false。顺便读一次额度
export type CodexCatalog = { available: boolean; models: CodexModel[]; limits?: Limits }

type RateLimitWindow = { usedPercent: number; windowDurationMins: number | null; resetsAt: number | null }
export type RateLimits = { limitId: string | null; primary: RateLimitWindow | null; secondary: RateLimitWindow | null; rateLimitReachedType: string | null }
type ListedModel = {
  id: string
  displayName: string
  hidden: boolean
  isDefault: boolean
  defaultReasoningEffort: string
  supportedReasoningEfforts: { reasoningEffort: string }[]
}

const timeout = 15_000
// 模型列表很少变，过一阵才重新问
const maxAge = 10 * 60_000
let cached: { at: number; catalog: Promise<CodexCatalog> } | undefined

export function codexCatalog(): Promise<CodexCatalog> {
  if (!cached || Date.now() - cached.at > maxAge) {
    cached = { at: Date.now(), catalog: readCatalog() }
  }
  return cached.catalog
}

type Request = <T>(method: string, params: unknown) => Promise<T | undefined>

// 起一个临时的 app-server，问完就结束；codex 没装、出错或超时时返回 fallback
export async function askCodex<T>(ask: (request: Request) => Promise<T>, fallback: T): Promise<T> {
  const server = spawn('codex', ['app-server'], { stdio: ['pipe', 'pipe', 'ignore'], env: { ...process.env, CODEX_HOME: codexHome } })
  const waiting = new Map<number, (result: unknown) => void>()
  let nextId = 0
  const request: Request = <R>(method: string, params: unknown) =>
    new Promise<R | undefined>((resolve) => {
      const id = ++nextId
      waiting.set(id, resolve as (result: unknown) => void)
      server.stdin.write(JSON.stringify({ id, method, params }) + '\n')
    })
  createInterface({ input: server.stdout }).on('line', (line) => {
    try {
      const message = JSON.parse(line) as { id?: number; method?: string; result?: unknown }
      if (message.id !== undefined && !message.method) {
        waiting.get(message.id)?.(message.result)
      }
    } catch {
      // 不认识的行
    }
  })
  const failed = new Promise<T>((resolve) => {
    server.on('error', () => resolve(fallback))
    server.on('exit', () => resolve(fallback))
    setTimeout(() => resolve(fallback), timeout).unref()
  })
  const run = async () => {
    await request('initialize', { clientInfo: { name: 'binos', title: 'binOS', version: '1' }, capabilities: null })
    server.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n')
    return ask(request)
  }
  try {
    return await Promise.race([run(), failed])
  } finally {
    server.kill()
  }
}

function readCatalog(): Promise<CodexCatalog> {
  const unavailable: CodexCatalog = { available: false, models: [] }
  return askCodex(async (request) => {
    const account = await request<{ account: unknown }>('account/read', {})
    if (!account?.account) {
      return unavailable
    }
    const [list, rateLimits] = await Promise.all([
      request<{ data: ListedModel[] }>('model/list', {}),
      request<{ rateLimits?: RateLimits }>('account/rateLimits/read', {}),
    ])
    const models = (list?.data ?? [])
      .filter((model) => !model.hidden)
      .map((model) => ({
        id: model.id,
        name: model.displayName,
        efforts: model.supportedReasoningEfforts.map((option) => option.reasoningEffort),
        defaultEffort: model.defaultReasoningEffort,
        isDefault: model.isDefault,
      }))
    const limits = rateLimits?.rateLimits && codexLimits(rateLimits.rateLimits, new Date().toISOString())
    return { available: true, models, ...(limits && { limits }) }
  }, unavailable)
}

// usedPercent 是 0 到 100；按窗口长短对应到 5 小时和 7 天。只看 codex 自己的额度，别的（比如某个模型单独的）不管
export function codexLimits(limits: RateLimits, time: string): Limits | undefined {
  if (limits.limitId && limits.limitId !== 'codex') {
    return undefined
  }
  const windows: Pick<Limits, 'fiveHour' | 'sevenDay'> = {}
  for (const window of [limits.primary, limits.secondary]) {
    if (window?.resetsAt && window.windowDurationMins !== null) {
      windows[window.windowDurationMins <= 5 * 60 ? 'fiveHour' : 'sevenDay'] = { utilization: window.usedPercent / 100, resetsAt: window.resetsAt }
    }
  }
  return { status: limits.rateLimitReachedType ? 'rejected' : 'allowed', ...windows, updatedAt: time }
}

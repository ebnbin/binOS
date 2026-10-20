import type { AgentId } from '../types.js'
import { claude } from './claude/driver.js'
import { codex } from './codex/driver.js'
import type { Driver } from './types.js'

export const drivers: Record<AgentId, Driver> = { claude, codex }

// 运行 agent 和查账号的命令用的环境变量：去掉从后端继承来的各个 agent 的设置，再指向这个 agent 自己的配置目录
export function agentEnv(agent: AgentId): NodeJS.ProcessEnv {
  const inherited = Object.values(drivers).map((driver) => driver.inheritedEnv)
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !inherited.some((pattern) => pattern.test(key))))
  return { ...env, ...drivers[agent].env }
}

// 不适用于这个 agent 的模型和思考程度去掉，用 agent 的默认
export function fitOptions(agent: AgentId, options: { model?: string; effort?: string }): { model?: string; effort?: string } {
  const { models, efforts } = drivers[agent]
  const fits = (value: string | undefined, names: readonly string[] | undefined) => (value && (!names || names.includes(value)) ? value : undefined)
  const model = fits(options.model, models)
  const effort = fits(options.effort, efforts)
  return { ...(model && { model }), ...(effort && { effort }) }
}

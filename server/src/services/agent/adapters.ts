import type { Adapter } from './adapter.js'
import { claude } from './claude/index.js'
import { codex } from './codex/index.js'
import type { Provider } from './types.js'

export const adapters: Record<Provider, Adapter> = { claude, codex }

// 运行 agent 和查账号的命令用的环境变量：去掉从后端继承来的各个 agent 的设置，再指向这个 agent 自己的配置目录
export function agentEnv(provider: Provider): NodeJS.ProcessEnv {
  const inherited = Object.values(adapters).map((adapter) => adapter.inheritedEnv)
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !inherited.some((pattern) => pattern.test(key))))
  return { ...env, ...adapters[provider].env }
}

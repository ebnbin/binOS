import type { AgentOutput, OutputOptions } from './output.js'
import type { AgentAccount, AgentCatalog } from './types.js'

// sessionId：接着 agent 那边的这个会话，没有就开一个新的；model、effort 没有时用 agent 自己的默认；instructions：追加的系统提示
export type Launch = { sessionId?: string; model?: string; effort?: string; instructions?: string }

// 一种 agent 的接入：怎么启动、怎么读它的输出、怎么查账号。
// 启动后从标准输入收 Claude Code stream-json 格式的消息（user、interrupt），不是这个格式的由转接进程翻译
export type Adapter = {
  // 登录和配置所在的目录，env 让 agent 和它的命令行工具用这个目录
  configDir: string
  env: Record<string, string>
  // 后端可能是从某个 agent 里启动的（比如测试实例），这些环境变量不能继承给任何 agent
  inheritedEnv: RegExp
  command(launch: Launch): string[]
  output(options: OutputOptions): AgentOutput
  // 消息里怎么让它查看本机的文件
  viewHint: string
  // 能选的模型和思考程度，不在里面的不传给它；没有时由 agent 自己判断
  models?: readonly string[]
  efforts?: readonly string[]
  // 报告的额度只有变了的窗口，要和之前的合并
  partialLimits?: true
  // env 是 agentEnv 给的；能选的模型列表现查时由它自己缓存
  catalog(env: NodeJS.ProcessEnv): Promise<Omit<AgentCatalog, 'provider'>>
  account(env: NodeJS.ProcessEnv): Promise<Omit<AgentAccount, 'provider' | 'running'>>
  // 启动时另加的环境变量，每次启动时现定（比如换用哪份登录）
  authEnv?(): Record<string, string>
  // 回答时请求被拒绝（登录无效）：处理后返回给用户看的原因，这次运行以它出错结束
  authFailed?(): string
}

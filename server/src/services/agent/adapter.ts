import type { AgentOutput, OutputOptions } from './output.js'
import type { AgentAccount } from './types.js'

// sessionId：接着 agent 那边的这个会话，没有就开一个新的；model、effort 没有时用 agent 自己的默认；instructions：追加的系统提示
export type Launch = { sessionId?: string; model?: string; effort?: string; instructions?: string }

// 一种 agent 的接入：怎么启动、怎么读它的输出、怎么查账号。
// 启动后从标准输入收 Claude Code stream-json 格式的消息（user、interrupt），不是这个格式的由转接进程翻译
export type Adapter = {
  command(launch: Launch): string[]
  output(options: OutputOptions): AgentOutput
  // 消息里怎么让它查看本机的文件
  viewHint: string
  // 能选的模型和思考程度，不在里面的不传给它；没有时由 agent 自己判断
  models?: readonly string[]
  efforts?: readonly string[]
  // 报告的额度只有变了的窗口，要和之前的合并
  partialLimits?: true
  account(): Promise<Omit<AgentAccount, 'provider' | 'running'>>
}

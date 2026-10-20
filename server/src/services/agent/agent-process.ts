import type { HostCommand, HostReply } from './host/protocol.js'

// thread 打交道的 agent 进程：输出一行行写在 output 文件里，错误信息在 errors 文件里。
// itemsFrom：它启动时 thread 已经有几条，之后带 offset 的条目都出自它的输出
export interface AgentProcess {
  readonly output: string
  readonly errors: string
  readonly itemsFrom: number
  // 换了模型、思考程度、agent 版本、AGENTS.md 这些启动时就定下的东西，要换一个进程；undefined 表示不能接着用，这一轮结束就让它退出
  readonly stamp: string | undefined
  // 能接着发命令；false 时只跟着读完它的输出
  readonly commandable: boolean
  running(): boolean
  send(command: HostCommand): Promise<HostReply>
  // 结束整个进程组，包括 agent 在后台启动的任务
  kill(): void
  // 进程已经结束，删掉它的文件
  dispose(): void
}

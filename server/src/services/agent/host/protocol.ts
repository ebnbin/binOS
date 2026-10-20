// host 进程和后端之间的约定。host 不随后端重启，上线后新的后端要和旧的 host 打交道：改了这里的约定就把版本加一，
// 后端遇到版本不同的 host，等它这一轮答完就让它退出，下一轮换新的
export const hostProtocol = 1

// host 持有哪种 agent：host 进程里按它选择怎么启动 agent、怎么把命令交给它
export type HostAgent = 'claude' | 'codex'

// host 启动时读的配置。socket：后端发命令用的地址；output、errors：agent 的输出和错误信息写在这里
export type HostLaunch = { agent: HostAgent; args: unknown; socket: string; output: string; errors: string }

// 后端发给 host 的命令：message 交给 agent 一句话（回答中途就是插话）；interrupt 停下正在做的事，会话和上下文都保留；
// close 不再有新的话，agent 处理完已经交过去的就退出，host 随之退出
export type HostCommand = { type: 'message'; text: string } | { type: 'interrupt' } | { type: 'close' }

// 每条命令都有回执，交不过去时带上原因
export type HostReply = { ok: true } | { ok: false; error: string }

// host 里的一种 agent：start 启动 agent，它的输出一行行交给 output，退出时调用 exit；handle 把命令交给它
export type HostAgentRunner = {
  start(args: unknown, io: { output(line: string): void; error(text: string): void; exit(code: number): void }): void
  handle(command: HostCommand): Promise<HostReply>
}

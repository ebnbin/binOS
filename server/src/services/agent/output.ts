import type { AgentRecord, Limits, Live, LiveEvent } from './types.js'

// 工具结果的文字只留末尾这么多：出错时要看的报错一般在最后
export const outputLimit = 64 * 1024

export const emptyLive = (): Live => ({ thinking: '', text: '', status: null, tasks: {} })

// filesDir：工具结果里的图片存在这里；recorded：调用方已经记下的最大 offset；sessionId：接着的 agent 会话
export type OutputOptions = { filesDir: string; recorded: number; sessionId: string | undefined }

// 一次运行期间把 agent 的原始输出逐行转成记录和临时内容的变化。输出总是从头读：
// 后端重启后，调用方已经记下的那些行（offset 不超过 recorded）只用来恢复状态，不再产生记录和推送。
// answered 是答完了、之后还没有新的动静：插的话会让它接着答，没人插话就可以让它退出了
export interface AgentOutput {
  answered: boolean
  // 主对话里还在后台运行、没有结束的工具调用
  backgroundTasks(): number
  current(): Live
  // offset 是这一行在输出文件里的结束位置；limits 是这一行报告的订阅额度；authFailed：请求因为登录无效被拒绝了
  push(text: string, offset: number): { records: AgentRecord[]; events: LiveEvent[]; limits?: Limits; authFailed?: true }
  finish(options: { startedAt: string; stopped: boolean; errors: string }): AgentRecord[]
}

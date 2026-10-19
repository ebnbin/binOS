export type Context = { tokens: number; window: number }
// 用掉的 token：输入、输出、读缓存、写缓存
export type Tokens = { input: number; output: number; cacheRead: number; cacheWrite: number }

// 运行 agent 的程序：显示的名字，额度存在系统状态的哪一项。怎么接入在服务端的 adapters.ts，按同样的 id 对应
export const agents = {
  claude: { name: 'Claude', limitsKey: 'agent/limits' },
  codex: { name: 'Codex', limitsKey: 'agent/codex-limits' },
} as const satisfies Record<string, { name: string; limitsKey: string }>
export type Provider = keyof typeof agents
export const providers = Object.keys(agents) as Provider[]
// 没有写明 agent 的记录（有多个 agent 之前的数据）和没选 agent 的新对话用它
export const defaultProvider: Provider = 'claude'

// 能选的模型：efforts 是它支持的思考程度，isDefault 是不指定模型时 agent 用的
export type AgentModel = { id: string; name: string; efforts: string[]; isDefault?: boolean }
// 一个 agent 能不能用（装了、登录了），能选哪些模型；efforts 是不指定模型时能选的思考程度
export type AgentCatalog = { provider: Provider; available: boolean; models: AgentModel[]; efforts: string[] }

// offset 是产生它的那一行在这次运行的原始输出里的结束位置，接上运行时从调用方记下的最后一个 offset 之后接着给；
// 运行结束时补的没有 offset。parent 是子 agent 的记录所属的那次工具调用
type Produced = { offset?: number; parent?: string }

// 一次运行产生的记录，以内容块为粒度：一段思考、一段文字、一次工具调用、一个工具结果各一条，运行结束时是 result
export type AgentRecord =
  // agent 那边的会话建立了，之后的运行用 resume 接着这个会话
  | ({ type: 'agent'; time: string; provider: Provider; sessionId: string } & Produced)
  // 思考的摘要；durationMs 是想了多久，不知道开始时间（后端重启时正在想）就没有
  | ({ type: 'thinking'; time: string; text: string; durationMs?: number } & Produced)
  | ({ type: 'text'; time: string; text: string } & Produced)
  | ({ type: 'tool_use'; time: string; id: string; name: string; input: unknown; background?: true } & Produced)
  // output 是结果文字的末尾一段，truncated 表示前面还有被省略的；images 是结果里的图片，在运行的 filesDir 里
  | ({
      type: 'tool_result'
      time: string
      toolUseId: string
      status: 'done' | 'error'
      output?: string
      truncated?: true
      images?: string[]
    } & Produced)
  // 上下文被压缩了：手动还是自动，压缩前后各多少 token
  | ({ type: 'compact'; time: string; trigger: string; preTokens?: number; postTokens?: number } & Produced)
  // outputTokens 含子 agent 的；context 是结束时的上下文大小；sessionUsage 是 agent 会话到这次运行为止按模型累计的用量
  | {
      type: 'result'
      time: string
      durationMs: number
      outcome?: 'stopped' | 'error'
      error?: string
      model?: string
      outputTokens?: number
      context?: Context
      sessionUsage?: Record<string, Tokens>
    }

// 运行中不成为记录的临时内容：当前在做什么
export type Status =
  | { type: 'requesting' }
  | { type: 'thinking' }
  | { type: 'tool'; name: string }
  | { type: 'compacting' }
  | { type: 'retrying'; attempt: number }
  // 答完了，等后台任务结束后接着答
  | { type: 'waiting'; tasks: number }

// 子 agent 或后台任务正在做的一步，以及到目前为止调用了几次工具、用了多少 token
export type TaskProgress = { activity?: string; toolUses?: number; tokens?: number }

// 正在想的那段思考、正在写的那段文字，记成记录后清空；tasks 按对应的工具调用 id
export type Live = {
  thinking: string
  text: string
  status: Status | null
  tasks: Record<string, TaskProgress>
}

// 临时内容的变化
export type LiveEvent =
  | { type: 'thinking'; text: string }
  | { type: 'text'; text: string }
  | { type: 'status'; status: Status | null }
  | { type: 'task'; toolUseId: string; progress: TaskProgress | null }

// 订阅额度：5 小时和 7 天两个窗口各用了多少（0 到 1），什么时候重置（秒级时间戳）；status 不是 allowed 时已被限流。
// agent 运行时报告，按 agent 存在系统状态里（agents 的 limitsKey）
export type QuotaWindow = { utilization: number; resetsAt: number }
export type Limits = { status: string; fiveHour?: QuotaWindow; sevenDay?: QuotaWindow; updatedAt: string }

// 系统 app 里 agent 的详细信息，每次打开时现查。没装、没登录或读不到的项没有
export type AgentAccount = {
  provider: Provider
  version?: string
  loggedIn: boolean
  email?: string
  organization?: string
  // 订阅的套餐，原样显示
  plan?: string
  // 登录凭证：访问令牌什么时候过期、上次续期的时间，有刷新令牌时到期前会自动续
  token?: { expiresAt?: string; refreshedAt?: string; refreshable: boolean }
  // Codex 送的额度重置次数，最早的那次什么时候过期
  resetCredits?: { count: number; expiresAt?: string }
  // 登录和配置存放的目录
  configDir: string
  // 正在运行的次数，不分是哪个 app 发起的
  running: number
}

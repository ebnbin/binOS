// 用户发消息时附上的文件。file 是 session 的 files/ 里的文件名，name 是原来的文件名
export type Attachment = { file: string; name: string }

export type Context = { tokens: number; window: number }
// 用掉的 token：输入、输出、读缓存、写缓存
export type Tokens = { input: number; output: number; cacheRead: number; cacheWrite: number }

// 由 agent 的输出产生的记录：offset 是产生它的那一行在这一轮原始输出里的结束位置，后端重启后从最后一条的 offset 之后接着记；
// 一轮结束时补记的没有 offset。parent 是子 agent 的记录所属的那次工具调用
type Produced = { offset?: number; parent?: string }

// transcript.jsonl 的一行：只追加，发生时就写，是 session 唯一的真相。
// 对话以内容块为粒度，一段思考、一段文字、一次工具调用、一个工具结果各一条；没在回答时的 user 开始一轮，result 结束一轮
// 一轮进行中又出现的 user 是回答中途插的话，interrupt 表示插话前先打断了正在做的事。
// 开始一轮的 user 带着这一轮用的 agent（没有是 Claude）、模型和思考程度（没有是 agent 的默认）
export type TranscriptRecord =
  | {
      type: 'user'
      time: string
      text: string
      attachments?: Attachment[]
      interrupt?: true
      provider?: Provider
      model?: string
      effort?: string
    }
  // 用户给 session 改名
  | { type: 'title'; time: string; title: string }
  // agent 那边的会话建立了，之后的轮次接着这个会话
  | ({ type: 'agent'; time: string; provider: Provider; sessionId: string } & Produced)
  // 思考的摘要；durationMs 是想了多久，不知道开始时间（后端重启时正在想）就没有
  | ({ type: 'thinking'; time: string; text: string; durationMs?: number } & Produced)
  // files：文字里引用的本机文件（原样的路径）对应的快照，在 files/ 里
  | ({ type: 'text'; time: string; text: string; files?: Record<string, string> } & Produced)
  | ({ type: 'tool_use'; time: string; id: string; name: string; input: unknown; background?: true } & Produced)
  // output 是结果文字的末尾一段，truncated 表示前面还有被省略的；images 是结果里的图片，在 files/ 里
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
  // outputTokens 含子 agent 的；context 是结束时的上下文大小；sessionUsage 是 agent 会话到这一轮为止按模型累计的用量
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

// 回答用的 agent：Claude Code 或 Codex，一个 session 自始至终用同一个
export const providers = ['claude', 'codex'] as const
export type Provider = (typeof providers)[number]

// Claude 的模型用 Claude Code 的别名，总是对应各系列最新的模型
export const claudeModels = ['fable', 'opus', 'sonnet', 'haiku'] as const
export const claudeEfforts = ['low', 'medium', 'high', 'xhigh', 'max'] as const

// Codex 的模型由 codex 列出，各自支持的思考程度不同；isDefault 是 codex 默认用的
export type CodexModel = { id: string; name: string; efforts: string[]; defaultEffort: string; isDefault: boolean }

// session 里开的 PR；state、title 查到了才有，preview 是开着的 binOS 自己的 PR 正在运行的预览
export type PullRequest = { url: string; number: number; state?: 'open' | 'merged' | 'closed'; title?: string; preview?: string }

export type SessionSummary = {
  id: number
  // 改过名就是改的名字；否则是第一条用户消息，没写字时是第一个附件的文件名
  title: string
  updatedAt: string
  // running：正在回答；waiting：答完了，在等后台任务
  running: boolean
  waiting: boolean
  // 最近一轮答完之后还没看过
  unread: boolean
  outcome?: 'stopped' | 'error'
  pinned: boolean
  archived: boolean
  context?: Context
  provider: Provider
  // 最近一轮用的模型和思考程度
  model?: string
  effort?: string
  prs: PullRequest[]
}

// 回答进行中只推给页面、不写进 transcript 的：正在想的那段思考，正在写的那段文字和它引用的文件，当前在做什么
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

// tasks 按对应的工具调用 id
export type Live = {
  thinking: string
  text: string
  files: Record<string, string>
  status: Status | null
  tasks: Record<string, TaskProgress>
}

// record 带着它是第几条；live 是连上时（以及一轮结束时）的临时内容，null 表示没在回答；
// 其余是临时内容的变化。写进 transcript 的思考和文字取代对应的临时内容
export type LiveEvent =
  | { type: 'record'; index: number; record: TranscriptRecord }
  | { type: 'live'; live: Live | null }
  | { type: 'thinking'; text: string }
  | { type: 'text'; text: string }
  | { type: 'file'; path: string; name: string }
  | { type: 'status'; status: Status | null }
  | { type: 'task'; toolUseId: string; progress: TaskProgress | null }

// 订阅额度：5 小时和 7 天两个窗口各用了多少（0 到 1），什么时候重置（秒级时间戳）；status 不是 allowed 时已被限流。
// agent 回答时报告，按 agent 存在系统状态里
export type QuotaWindow = { utilization: number; resetsAt: number }
export type Limits = { status: string; fiveHour?: QuotaWindow; sevenDay?: QuotaWindow; updatedAt: string }
export const limitsKeys: Record<Provider, string> = { claude: 'agent/limits', codex: 'agent/codex-limits' }

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
  // 用这个 agent 的 session 数，其中正在回答的
  sessions: number
  running: number
}

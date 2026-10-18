// 用户发消息时附上的文件。file 是 session 的 files/ 里的文件名，name 是原来的文件名
export type Attachment = { file: string; name: string }

export type Context = { tokens: number; window: number }
// 用掉的 token：输入、输出、读缓存、写缓存
export type Tokens = { input: number; output: number; cacheRead: number; cacheWrite: number }

// 由 agent 的输出产生的记录：offset 是产生它的那一行在这一轮原始输出里的结束位置，后端重启后从最后一条的 offset 之后接着记；
// 一轮结束时补记的没有 offset。parent 是子 agent 的记录所属的那次工具调用
type Produced = { offset?: number; parent?: string }

// transcript.jsonl 的一行：只追加，发生时就写，是 session 唯一的真相。
// 对话以内容块为粒度，一段思考、一段文字、一次工具调用、一个工具结果各一条；user 开始一轮，result 结束一轮
export type TranscriptRecord =
  | { type: 'user'; time: string; text: string; attachments?: Attachment[] }
  // agent 那边的会话建立了，之后的轮次接着这个会话
  | ({ type: 'agent'; time: string; provider: 'claude'; sessionId: string } & Produced)
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

export type SessionSummary = {
  id: number
  // 第一条用户消息，没写字时是第一个附件的文件名
  title: string
  updatedAt: string
  running: boolean
}

// 回答进行中只推给页面、不写进 transcript 的：正在想的那段思考，正在写的那段文字和它引用的文件，当前在做什么
export type Status =
  | { type: 'requesting' }
  | { type: 'thinking' }
  | { type: 'tool'; name: string }
  | { type: 'compacting' }
  | { type: 'retrying'; attempt: number }

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

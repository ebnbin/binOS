import type { AgentRecord, Context, Live as AgentLive, LiveEvent as AgentLiveEvent, Provider } from '../../services/agent/types.js'

// 用户发消息时附上的文件。file 是 session 的 files/ 里的文件名，name 是原来的文件名
export type Attachment = { file: string; name: string }

type TextRecord = Extract<AgentRecord, { type: 'text' }>

// transcript.jsonl 的一行：只追加，发生时就写，是 session 唯一的真相。
// 没在回答时的 user 开始一轮，一轮是 agent 的一次运行，以运行的 result 结束；
// 一轮进行中又出现的 user 是回答中途插的话，interrupt 表示插话前先打断了正在做的事。
// 开始一轮的 user 带着这一轮用的 agent（没有是默认的 defaultProvider）、模型和思考程度（没有是 agent 的默认）
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
  | Exclude<AgentRecord, TextRecord>
  // files：文字里引用的本机文件（原样的路径）对应的快照，在 files/ 里
  | (TextRecord & { files?: Record<string, string> })

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

// 回答进行中只推给页面、不写进 transcript 的：agent 运行中的临时内容，加上正在写的文字引用的文件
export type Live = AgentLive & { files: Record<string, string> }

// record 带着它是第几条；live 是连上时（以及一轮结束时）的临时内容，null 表示没在回答；
// 其余是临时内容的变化。写进 transcript 的思考和文字取代对应的临时内容
export type LiveEvent =
  | { type: 'record'; index: number; record: TranscriptRecord }
  | { type: 'live'; live: Live | null }
  | AgentLiveEvent
  | { type: 'file'; path: string; name: string }

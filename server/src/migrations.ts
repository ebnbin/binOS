import { constants, copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { repoDir } from './apps/code/repositories.js'
import { agentServiceDir, appDir, libraryDir } from './paths.js'
import { claudeTool } from './services/agent/drivers/claude/tools.js'
import { appendItems, createThread, filesDir } from './services/agent/store.js'
import type { AgentId, Item, ToolDetail } from './services/agent/types.js'

// 后端启动时、各 app 启动前执行的数据迁移。每一步都先看是否已经做过，可以重复执行
export function migrate() {
  moveAgentData()
  moveSessionsToThreads()
  markLegacyRuns()
}

// 换成 thread 之前 agent 服务的数据目录。原来的数据留着：上线失败回退到旧版本时，旧版本还要用
const legacyAgentDir = path.join(libraryDir, 'agent')
const sessionsDir = path.join(appDir('code'), 'sessions')

// agent 的额度和登录失效的标记挪到 Library/Services/agent
function moveAgentData() {
  for (const name of ['limits.json', 'claude-login-broken', 'codex-login-broken']) {
    const from = path.join(legacyAgentDir, name)
    const to = path.join(agentServiceDir, name)
    if (existsSync(from) && !existsSync(to)) {
      mkdirSync(agentServiceDir, { recursive: true })
      copyFileSync(from, to)
    }
  }
}

// 换成 thread 之前 Code 的 transcript.jsonl 的一行，各种记录的字段放在一起
type TurnEnd = Extract<Item, { type: 'turn_end' }>
type LegacyRecord = {
  type: string
  time: string
  offset?: number
  parent?: string
  text?: string
  attachments?: { file: string; name: string }[]
  interrupt?: true
  provider?: AgentId
  model?: string
  effort?: string
  title?: string
  sessionId?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
  background?: true
  toolUseId?: string
  status?: 'done' | 'error'
  output?: string
  truncated?: true
  images?: string[]
  sessionUsage?: TurnEnd['usage']
} & Partial<Omit<TurnEnd, 'type' | 'time' | 'offset' | 'model'>>

// Code 的每个对话的 transcript 转成一个 thread，文件复制进 thread 的 files/。session.json 换成新的格式：
// 记着对应的 thread，保留置顶、归档、读到的时间和改过的名字
function moveSessionsToThreads() {
  if (!existsSync(sessionsDir)) {
    return
  }
  for (const name of readdirSync(sessionsDir)) {
    const dir = path.join(sessionsDir, name)
    const transcript = path.join(dir, 'transcript.jsonl')
    const old = readJson<{ thread?: string; pinned?: true; archived?: true; readAt?: string }>(path.join(dir, 'session.json'))
    if (!/^\d+$/.test(name) || !existsSync(transcript) || old?.thread) {
      continue
    }
    const records = readFileSync(transcript, 'utf8')
      .split('\n')
      .flatMap((line) => {
        try {
          return [JSON.parse(line) as LegacyRecord]
        } catch {
          return []
        }
      })
    if (records.length === 0) {
      continue
    }
    const { items, title } = convertTranscript(records)
    const first = records.find((record) => record.type === 'user')
    const thread = createThread({
      type: 'thread',
      time: records[0].time,
      agent: first?.provider ?? 'claude',
      owner: 'code',
      cwd: repoDir,
    })
    appendItems(thread, items)
    if (existsSync(path.join(dir, 'files'))) {
      cpSync(path.join(dir, 'files'), filesDir(thread), { recursive: true, mode: constants.COPYFILE_FICLONE })
    }
    const session = {
      thread,
      ...(title && { title }),
      ...(old?.pinned && { pinned: true }),
      ...(old?.archived && { archived: true }),
      ...(old?.readAt && { readAt: old.readAt }),
      scanned: 0,
      defaultTitle: '',
      prs: [],
      creatingPrs: [],
    }
    writeJson(path.join(dir, 'session.json'), session)
  }
}

function convertTranscript(records: LegacyRecord[]): { items: Item[]; title?: string } {
  const items: Item[] = []
  let title: string | undefined
  let inTurn = false
  for (const record of records) {
    const { type, time, offset, parent } = record
    const produced = { ...(offset !== undefined && { offset }), ...(parent && { parent }) }
    switch (type) {
      case 'user': {
        const { text = '', attachments, interrupt, model, effort } = record
        items.push({
          type: 'input',
          time,
          mode: !inTurn ? 'start' : interrupt ? 'interrupt' : 'steer',
          text,
          ...(attachments?.length && { attachments }),
          ...(!inTurn && model && { model }),
          ...(!inTurn && effort && { effort }),
        })
        inTurn = true
        break
      }
      case 'title':
        title = record.title
        break
      case 'agent':
        items.push({ type: 'agent_session', time, id: record.sessionId ?? '', ...produced })
        break
      case 'thinking':
      case 'text':
      case 'compact': {
        const { type: _type, provider: _provider, ...fields } = record
        items.push({ type, ...fields } as Item)
        break
      }
      case 'tool_use': {
        const { id = '', name = '', input = {}, background } = record
        items.push({ type: 'tool_call', time, id, name, ...legacyTool(name, input), ...(background && { background }), ...produced })
        break
      }
      case 'tool_result': {
        const { toolUseId = '', status = 'error', output, truncated, images } = record
        items.push({ type: 'tool_result', time, callId: toolUseId, status, ...(output && { output }), ...(truncated && { truncated }), ...(images && { images }), ...produced })
        break
      }
      case 'result': {
        const { durationMs = 0, outcome, error, model, outputTokens, context, sessionUsage } = record
        items.push({
          type: 'turn_end',
          time,
          durationMs,
          ...(outcome && { outcome }),
          ...(error !== undefined && { error }),
          ...(model && { model }),
          ...(outputTokens !== undefined && { outputTokens }),
          ...(context && { context }),
          ...(sessionUsage && { usage: sessionUsage }),
        })
        inTurn = false
        break
      }
    }
  }
  return { items, title }
}

// 旧记录里的工具：Claude 的原样，Codex 的命令、网页搜索、子 agent、MCP 已经用了 Claude 的名字，另有改文件的 Patch 和看图片的 ViewImage
function legacyTool(name: string, input: Record<string, unknown>): { tool: ToolDetail; input?: unknown } {
  const text = (value: unknown) => (typeof value === 'string' ? value : '')
  if (name === 'Patch') {
    const op = input.kind === 'add' || input.kind === 'delete' ? input.kind : 'update'
    return { tool: { kind: 'edit', path: text(input.file_path), change: { type: 'diff', op, diff: text(input.diff) } } }
  }
  if (name === 'ViewImage') {
    return { tool: { kind: 'image_view', path: text(input.file_path) } }
  }
  return claudeTool(name, input)
}

// 正在进行的旧运行记上它属于哪个 thread，后端启动后由 agent 服务接着跟完
function markLegacyRuns() {
  const runsDir = path.join(legacyAgentDir, 'runs')
  if (!existsSync(runsDir)) {
    return
  }
  for (const id of readdirSync(runsDir)) {
    const file = path.join(runsDir, id, 'state.json')
    const state = readJson<{ owner: string; ref: string; thread?: string }>(file)
    if (!state || state.thread || state.owner !== 'code') {
      continue
    }
    const thread = readJson<{ thread?: string }>(path.join(sessionsDir, state.ref, 'session.json'))?.thread
    if (thread) {
      writeJson(file, { ...state, thread })
    }
  }
}

function readJson<T>(file: string): T | undefined {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return undefined
  }
}

function writeJson(file: string, data: unknown) {
  writeFileSync(`${file}.tmp`, JSON.stringify(data, null, 2) + '\n')
  renameSync(`${file}.tmp`, file)
}

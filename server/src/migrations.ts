import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { replyFilesPrompt } from './apps/kita/reply-files.js'
import type { TranscriptRecord } from './apps/kita/types.js'
import { agentRunsDir, libraryDir, repoDir, sessionsDir } from './paths.js'
import { applyChanges, readState } from './state.js'
import type { JsonValue, StateChange } from './types.js'

// 后端启动时、各 app 启动前执行的数据迁移。每一步都先看是否已经做过，可以重复执行
export function migrate() {
  moveToKita()
  moveTurnsToRuns()
  renameAgentApp()
}

// Agent app 改名为喜多：对话和上传的附件归喜多，Library/agent/ 留给 agent 服务
function moveToKita() {
  for (const name of ['sessions', 'uploads']) {
    const from = path.join(libraryDir, 'agent', name)
    const to = path.join(libraryDir, 'kita', name)
    if (existsSync(from) && !existsSync(to)) {
      mkdirSync(path.dirname(to), { recursive: true })
      renameSync(from, to)
    }
  }
}

// 正在进行的回答原来在 session 的 turn/ 里，现在是 agent 服务的一次运行。
// 只是改名：agent 和转发进程打开的输出文件、管道不受影响，接着写、接着读
function moveTurnsToRuns() {
  if (!existsSync(sessionsDir)) {
    return
  }
  for (const id of readdirSync(sessionsDir)) {
    const sessionDir = path.join(sessionsDir, id)
    const turnDir = path.join(sessionDir, 'turn')
    if (!existsSync(turnDir)) {
      continue
    }
    const turn = readJson<{ agent: unknown; stopped?: true }>(path.join(turnDir, 'state.json'))
    // 没有 state.json：agent 没能启动，喜多启动时把这一轮记成出错
    if (!turn) {
      rmSync(turnDir, { recursive: true, force: true })
      continue
    }
    const records = readFileSync(path.join(sessionDir, 'transcript.jsonl'), 'utf8')
      .split('\n')
      .flatMap((line): TranscriptRecord[] => {
        try {
          return [JSON.parse(line)]
        } catch {
          return []
        }
      })
    const first = records.find((record) => record.type === 'user')
    const thread = records.findLast((record) => record.type === 'agent')
    const current = records[records.findLastIndex((record) => record.type === 'result') + 1]
    const runDir = path.join(agentRunsDir, randomUUID())
    mkdirSync(agentRunsDir, { recursive: true })
    renameSync(turnDir, runDir)
    for (const [from, to] of [
      ['claude-output.jsonl', 'output.jsonl'],
      ['claude-errors.log', 'errors.log'],
    ]) {
      if (existsSync(path.join(runDir, from))) {
        renameSync(path.join(runDir, from), path.join(runDir, to))
      }
    }
    const state = {
      owner: 'kita',
      ref: id,
      options: {
        provider: (first?.type === 'user' && first.provider) || 'claude',
        cwd: repoDir,
        filesDir: path.join(sessionDir, 'files'),
        ...(thread?.type === 'agent' && { resume: thread.sessionId }),
        instructions: replyFilesPrompt,
      },
      time: current?.time ?? new Date().toISOString(),
      agent: turn.agent,
      ...(turn.stopped && { stopped: true }),
    }
    writeFileSync(path.join(runDir, 'state.json'), JSON.stringify(state) + '\n')
  }
}

// 系统状态里窗口和桌面用 app 的 id 引用 app
function renameAgentApp() {
  const changes: StateChange[] = []
  for (const { key, value } of readState().entries) {
    if (key.startsWith('shell/windows/') && (value as { app?: unknown } | null)?.app === 'agent') {
      changes.push({ key, value: { ...(value as Record<string, JsonValue>), app: 'kita' } })
    }
    if (key === 'shell/desktop' && Array.isArray(value) && value.some((item) => (item as { app?: unknown } | null)?.app === 'agent')) {
      changes.push({ key, value: value.map((item) => ((item as { app?: unknown } | null)?.app === 'agent' ? { ...(item as Record<string, JsonValue>), app: 'kita' } : item)) })
    }
  }
  if (changes.length > 0) {
    applyChanges(changes)
  }
}

function readJson<T>(file: string): T | undefined {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return undefined
  }
}

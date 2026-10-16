import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { libraryDir, repoDir } from './paths.js'
import {
  appendEntry,
  createSession,
  listSessions,
  readSessionInfo,
  readTranscript,
  writeSessionInfo,
} from './sessions.js'
import type { Entry } from './sessions.js'

// 推给页面的事件：新写入的条目、正在生成的文字、是否有回答在进行
export type LiveEvent =
  | { type: 'entry'; index: number; entry: Entry }
  | { type: 'partial'; text: string }
  | { type: 'status'; running: boolean }

const listeners = new Map<number, Set<(event: LiveEvent) => void>>()

// 同一时间只有一个回答在进行
let running: { sessionId: number; text: string } | undefined

export function subscribe(sessionId: number, listener: (event: LiveEvent) => void) {
  const set = listeners.get(sessionId) ?? new Set()
  set.add(listener)
  listeners.set(sessionId, set)
  return () => {
    set.delete(listener)
  }
}

// 当前状态：页面连上时先拿到这个
export function liveState(sessionId: number): LiveEvent[] {
  if (running?.sessionId !== sessionId) {
    return [{ type: 'status', running: false }]
  }
  return [
    { type: 'status', running: true },
    { type: 'partial', text: running.text },
  ]
}

function emit(sessionId: number, event: LiveEvent) {
  for (const listener of listeners.get(sessionId) ?? []) {
    listener(event)
  }
}

function append(sessionId: number, fields: Parameters<typeof appendEntry>[1]) {
  const { entry, index } = appendEntry(sessionId, fields)
  emit(sessionId, { type: 'entry', index, entry })
}

// 开始一轮回答，返回 session 编号；已有回答在进行时返回 undefined。sessionId 为空时新建 session
export function startTurn(sessionId: number | undefined, text: string): number | undefined {
  if (running) {
    return undefined
  }
  const id = sessionId ?? createSession({ claudeSessionId: randomUUID() })
  // Claude 的会话在第一轮成功回答后才算建立；之前都失败过就换一个新的会话重新开始
  const established = readTranscript(id).some((entry) => entry.type === 'assistant')
  let { claudeSessionId } = readSessionInfo(id)
  if (!established && sessionId !== undefined) {
    claudeSessionId = randomUUID()
    writeSessionInfo(id, { claudeSessionId })
  }

  running = { sessionId: id, text: '' }
  append(id, { type: 'user', message: { role: 'user', content: text } })
  emit(id, { type: 'status', running: true })

  const child = spawn(
    'claude',
    [
      '-p', text,
      '--permission-mode', 'bypassPermissions',
      '--output-format', 'stream-json',
      '--verbose',
      '--include-partial-messages',
      established ? '--resume' : '--session-id', claudeSessionId,
    ],
    { cwd: repoDir, env: agentEnv(), stdio: ['ignore', 'pipe', 'pipe'] },
  )

  // 已完成的文字块，以及正在生成的那一块
  const blocks: string[] = []
  let partial = ''
  let result: { is_error?: boolean; result?: string; subtype?: string } | undefined
  let stderr = ''
  let buffer = ''

  const showProgress = () => {
    running!.text = [...blocks, partial].filter(Boolean).join('\n\n')
    emit(id, { type: 'partial', text: running!.text })
  }

  const handleLine = (line: string) => {
    let data
    try {
      data = JSON.parse(line)
    } catch {
      return
    }
    // 子任务的输出不算在这一轮的回答里
    if (data.parent_tool_use_id) {
      return
    }
    if (data.type === 'stream_event') {
      const event = data.event
      if (event.type === 'content_block_start' && event.content_block.type === 'text') {
        partial = ''
      } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        partial += event.delta.text
        showProgress()
      }
    } else if (data.type === 'assistant') {
      for (const block of data.message.content) {
        if (block.type === 'text') {
          blocks.push(block.text)
          partial = ''
        }
      }
      showProgress()
    } else if (data.type === 'result') {
      result = data
    }
  }

  child.stdout.on('data', (chunk) => {
    buffer += chunk
    const lines = buffer.split('\n')
    buffer = lines.pop()!
    lines.forEach(handleLine)
  })
  child.stderr.on('data', (chunk) => (stderr += chunk))

  let finished = false
  const finish = (error?: string) => {
    if (finished) {
      return
    }
    finished = true
    if (!error && result && !result.is_error) {
      append(id, {
        type: 'assistant',
        message: { role: 'assistant', content: blocks.map((text) => ({ type: 'text', text })) },
      })
    } else {
      append(id, {
        type: 'system',
        subtype: 'error',
        content: error ?? result?.result ?? (stderr.trim() || 'agent 异常退出'),
      })
    }
    running = undefined
    emit(id, { type: 'status', running: false })
  }
  child.on('error', (err) => finish(err.message))
  child.on('close', (code) => {
    if (buffer) {
      handleLine(buffer)
    }
    finish(result ? undefined : stderr.trim() || `agent 退出，代码 ${code}`)
  })
  return id
}

// 后端启动时：最后一条还是用户消息的 session，说明上次的回答被后端重启打断了
export function recoverInterruptedTurns() {
  for (const id of listSessions()) {
    if (readTranscript(id).at(-1)?.type === 'user') {
      appendEntry(id, { type: 'system', subtype: 'error', content: '回答被中断：后端在回答过程中重启了' })
    }
  }
}

// 不继承启动后端的环境里与 Claude 相关的设置，只指定 binOS 自己的配置目录
function agentEnv() {
  const env: NodeJS.ProcessEnv = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith('CLAUDE') && !key.startsWith('ANTHROPIC')) {
      env[key] = value
    }
  }
  env.CLAUDE_CONFIG_DIR = path.join(libraryDir, 'claude')
  return env
}

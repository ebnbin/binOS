import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { agentRunsDir, libraryDir } from './paths.js'
import { applyChanges, readState } from './state.js'
import type { JsonValue, StateChange } from './types.js'

// 后端启动时、各 app 启动前执行的数据迁移。每一步都先看是否已经做过，可以重复执行
export function migrate() {
  renameKitaToCode()
}

// 对话 app 的 id 从 kita 改为 code：数据目录、进行中的 agent 运行的归属、窗口和桌面引用的 app
function renameKitaToCode() {
  const from = path.join(libraryDir, 'kita')
  const to = path.join(libraryDir, 'code')
  if (existsSync(from) && !existsSync(to)) {
    renameSync(from, to)
  }

  if (existsSync(agentRunsDir)) {
    for (const id of readdirSync(agentRunsDir)) {
      const file = path.join(agentRunsDir, id, 'state.json')
      const state = readJson<{ owner?: string }>(file)
      if (state?.owner === 'kita') {
        writeFileSync(`${file}.tmp`, JSON.stringify({ ...state, owner: 'code' }) + '\n')
        renameSync(`${file}.tmp`, file)
      }
    }
  }

  const isKita = (item: unknown) => (item as { app?: unknown } | null)?.app === 'kita'
  const withCode = (item: JsonValue) => ({ ...(item as Record<string, JsonValue>), app: 'code' })
  const changes: StateChange[] = []
  for (const { key, value } of readState().entries) {
    if (key.startsWith('shell/windows/') && isKita(value)) {
      changes.push({ key, value: withCode(value) })
    }
    if (key === 'shell/desktop' && Array.isArray(value) && value.some(isKita)) {
      changes.push({ key, value: value.map((item) => (isKita(item) ? withCode(item) : item)) })
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

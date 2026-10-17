import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { notifyChange } from './events.js'
import { statePath } from './paths.js'
import type { JsonValue, StateChange, StateEntry } from './types.js'

// 系统状态：所有设备共用的一组键值，每次改动后整体写入 state.json。
// 只有这个后端读写这个文件（根目录锁保证），所以启动后一直以内存里的为准

type Stored = { version: number; entries: Record<string, { value: JsonValue; version: number }> }

const keyPattern = /^[a-z0-9-]+(\/[a-z0-9-]+)*$/
const maxKeyLength = 200
const maxValueBytes = 64 * 1024
const maxChanges = 100

let stored: Stored | undefined

function load(): Stored {
  stored ??= existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : { version: 0, entries: {} }
  return stored!
}

export function readState(): { version: number; entries: StateEntry[] } {
  const { version, entries } = load()
  return { version, entries: Object.entries(entries).map(([key, entry]) => ({ key, ...entry })) }
}

export function parseChanges(input: unknown): StateChange[] | undefined {
  if (!Array.isArray(input) || input.length === 0 || input.length > maxChanges) {
    return undefined
  }
  const changes: StateChange[] = []
  for (const item of input as { key?: unknown; value?: unknown }[]) {
    const { key, value } = item ?? {}
    if (typeof key !== 'string' || key.length > maxKeyLength || !keyPattern.test(key) || value === undefined) {
      return undefined
    }
    if (Buffer.byteLength(JSON.stringify(value)) > maxValueBytes) {
      return undefined
    }
    changes.push({ key, value: value as JsonValue })
  }
  return changes
}

// 一组改动共用一个新版本号。写入文件成功后才替换内存里的状态，失败时内存和文件都保持原样
export function applyChanges(changes: StateChange[]): number {
  const current = load()
  const version = current.version + 1
  const entries = { ...current.entries }
  for (const { key, value } of changes) {
    if (value === null) {
      delete entries[key]
    } else {
      entries[key] = { value, version }
    }
  }
  const next: Stored = { version, entries }
  write(next)
  stored = next
  notifyChange({ type: 'state', version, changes })
  return version
}

// 先写临时文件并落盘，再改名覆盖：中途崩溃时 state.json 仍是上一次的完整内容
function write(data: Stored) {
  mkdirSync(path.dirname(statePath), { recursive: true })
  const temp = `${statePath}.tmp`
  const fd = openSync(temp, 'w')
  try {
    writeFileSync(fd, JSON.stringify(data) + '\n')
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
  renameSync(temp, statePath)
}

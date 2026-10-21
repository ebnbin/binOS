import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { codeInstructions } from '../apps/code/instructions.js'
import { encodeEntries } from '../services/kita/journal.js'
import type { Entry } from '../services/kita/types.js'

const json = (file: string) => JSON.parse(readFileSync(file, 'utf8'))
function write(file: string, value: unknown) {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(`${file}.tmp`, JSON.stringify(value, null, 2) + '\n', { flush: true })
  renameSync(`${file}.tmp`, file)
}

function digest(file: string) { return createHash('sha256').update(readFileSync(file)).digest('hex') }

function inventory(dir: string, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {}
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const key = path.join(prefix, entry.name)
    if (entry.isDirectory()) Object.assign(result, inventory(path.join(dir, entry.name), key))
    else if (entry.isFile()) result[key] = digest(path.join(dir, entry.name))
  }
  return result
}

function verifyCopy(source: string, target: string) {
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    // host 由独立进程持续写入，不能把它当作静态快照校验或移动。
    if (entry.name === 'host') continue
    const a = path.join(source, entry.name)
    const b = path.join(target, entry.name)
    if (entry.isDirectory()) verifyCopy(a, b)
    else if (entry.isFile() && digest(a) !== digest(b)) throw new Error(`Kita 迁移备份校验失败：${a}`)
  }
}

function records(file: string): Entry[] {
  const text = readFileSync(file, 'utf8')
  const lines = text.split('\n')
  return lines.flatMap((line, index) => {
    if (!line.trim()) return []
    let entry: Entry & { type: string }
    try { entry = JSON.parse(line) } catch (error) {
      throw new Error(`Kita 迁移发现损坏记录：${file}:${index + 1}`, { cause: error })
    }
    if ((entry as { type: string }).type === 'thread') entry = { ...entry, type: 'session' } as Entry
    return [entry]
  })
}

// 只在持有根目录锁、旧后端已停止后执行。完成标记之前不会启动任何数据使用者。
export function migrateAgentToKita(root: string) {
  const services = path.join(root, 'Library', 'Services')
  const source = path.join(services, 'agent')
  const target = path.join(services, 'kita')
  const migration = path.join(services, 'kita-migration')
  const completed = path.join(migration, 'completed.json')
  if (existsSync(completed) || !existsSync(source)) return
  // 建立备份后不能再让旧后端写入源数据，否则重试迁移会使用过期快照。
  write(path.join(root, 'Library', 'binos', 'data-revision.json'), { revision: 'kita-sessions-v1' })
  const backup = path.join(migration, 'backup')
  const code = path.join(root, 'Library', 'Apps', 'code', 'sessions')
  const backupReady = path.join(migration, 'backup-ready.json')
  if (!existsSync(backupReady)) {
    rmSync(backup, { recursive: true, force: true })
    mkdirSync(backup, { recursive: true })
    cpSync(source, path.join(backup, 'agent'), { recursive: true })
    verifyCopy(source, path.join(backup, 'agent'))
    if (existsSync(code)) {
      cpSync(code, path.join(backup, 'code'), { recursive: true })
      verifyCopy(code, path.join(backup, 'code'))
    }
    write(backupReady, { time: new Date().toISOString() })
  }
  // 若旧代码曾被手动重启，拒绝使用已经落后于源数据的备份。
  verifyCopy(source, path.join(backup, 'agent'))
  const stage = path.join(migration, 'staged')
  const published = path.join(migration, 'publishing.json')
  if (!existsSync(published)) {
    if (existsSync(target)) throw new Error('Kita 目标目录已存在，但没有迁移发布记录')
    rmSync(stage, { recursive: true, force: true })
    mkdirSync(path.join(stage, 'sessions'), { recursive: true })
    const old = path.join(backup, 'agent')
    for (const name of readdirSync(old)) {
      if (name !== 'threads') cpSync(path.join(old, name), path.join(stage, name), { recursive: true })
    }
    const threads = path.join(old, 'threads')
    const ids = existsSync(threads) ? readdirSync(threads) : []
    for (const id of ids) {
      const dir = path.join(threads, id)
      if (!statSync(dir).isDirectory()) continue
      if (!existsSync(path.join(dir, 'items.jsonl'))) throw new Error(`缺少原始记录：${id}`)
      const entries = records(path.join(dir, 'items.jsonl'))
      const first = entries[0]
      if (first?.type !== 'session' || !first.agent || !first.owner || !first.cwd) throw new Error(`会话头不正确：${id}`)
      if (first.owner === 'code') first.instructions = [codeInstructions, first.instructions].filter(Boolean).join('\n\n')
      const dest = path.join(stage, 'sessions', id)
      mkdirSync(dest, { recursive: true })
      write(path.join(dest, 'metadata.json'), { ...first, format: 1, id })
      const events = encodeEntries(entries, undefined)
      // 历史记录逐条形成已提交批次，保持条目编号及旧 host 的 itemsFrom 完全一致。
      writeFileSync(path.join(dest, 'events.jsonl'), events.map((event) => JSON.stringify({ events: [event] }) + '\n').join(''), { flush: true })
      if (events.length !== entries.length || events.some((event, i) => JSON.stringify(event.data) !== JSON.stringify(entries[i]))) throw new Error(`会话转换校验失败：${id}`)
      const files = path.join(dir, 'files')
      if (existsSync(files)) {
        cpSync(files, path.join(dest, 'files'), { recursive: true })
        verifyCopy(files, path.join(dest, 'files'))
      }
      const workerDir = path.join(source, 'threads', id, 'host')
      if (existsSync(workerDir)) write(path.join(dest, 'runtime.json'), { workerDir })
    }
    const references: { file: string; data: Record<string, unknown> }[] = []
    const savedCode = path.join(backup, 'code')
    for (const name of existsSync(savedCode) ? readdirSync(savedCode) : []) {
      const file = path.join(savedCode, name, 'session.json')
      if (!existsSync(file)) continue
      const data = json(file) as Record<string, unknown>
      const { thread, ...rest } = data
      if (typeof thread !== 'string' || !existsSync(path.join(stage, 'sessions', thread, 'metadata.json'))) throw new Error(`Code session ${name} 的引用不完整`)
      references.push({ file: path.join(code, name, 'session.json'), data: { ...rest, project: rest.project ?? 'binos', kitaSession: thread } })
    }
    write(path.join(migration, 'references.json'), references)
    write(published, { sessions: ids.length, references: references.length, files: inventory(stage) })
  }
  // 发布记录先落盘：崩溃发生在 rename 前后，都可以继续到同一份目标数据。
  if (!existsSync(target)) renameSync(stage, target)
  const publication = json(published) as { files: Record<string, string> }
  for (const [file, expected] of Object.entries(publication.files)) {
    if (digest(path.join(target, file)) !== expected) throw new Error(`Kita 发布数据校验失败：${file}`)
  }
  const references = json(path.join(migration, 'references.json')) as { file: string; data: Record<string, unknown> }[]
  for (const { file, data } of references) write(file, data)
  write(completed, { ...json(published), time: new Date().toISOString() })
}

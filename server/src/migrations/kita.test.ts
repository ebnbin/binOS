import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { migrateAgentToKita } from './kita.js'

function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'binos-kita-migration-'))
  const old = path.join(root, 'Library/Services/agent/threads/a')
  const code = path.join(root, 'Library/Apps/code/sessions/1/session.json')
  mkdirSync(path.join(old, 'files'), { recursive: true })
  mkdirSync(path.dirname(code), { recursive: true })
  const entries = [
    { type: 'thread', time: '2026-10-20T00:00:00Z', agent: 'codex', owner: 'code', cwd: root },
    { type: 'input', time: '2026-10-20T00:00:01Z', mode: 'start', text: 'hello', attachments: [{ file: 'a.png', name: '图片.png' }] },
    { type: 'agent_session', time: '2026-10-20T00:00:02Z', id: 'vendor-session', offset: 150 },
    { type: 'text', time: '2026-10-20T00:00:03Z', text: 'world', offset: 300, files: { '/tmp/a.png': 'a.png' } },
  ]
  writeFileSync(path.join(old, 'items.jsonl'), entries.map((entry) => JSON.stringify(entry) + '\n').join(''))
  writeFileSync(path.join(old, 'files/a.png'), 'exact-image-bytes')
  mkdirSync(path.join(old, 'host'))
  writeFileSync(path.join(old, 'host/output.jsonl'), 'raw-output\n')
  writeFileSync(code, JSON.stringify({ thread: 'a', pinned: true, readAt: 'yesterday', scanned: 4, prs: ['pr'], creatingPrs: [] }))
  writeFileSync(path.join(root, 'Library/Services/agent/limits.json'), '{"codex":{"limited":false}}')
  return { root, old, code, entries, target: path.join(root, 'Library/Services/kita/sessions/a'), migration: path.join(root, 'Library/Services/kita-migration') }
}

describe('Kita migration', () => {
  it('保留记录顺序、vendor 会话、offset、附件、用户状态和原运行路径；重复执行不再改动', () => {
    const f = fixture()
    const before = readFileSync(path.join(f.old, 'items.jsonl'))
    migrateAgentToKita(f.root)
    const events = readFileSync(path.join(f.target, 'events.jsonl'), 'utf8').trim().split('\n').flatMap((line) => JSON.parse(line).events)
    expect(events.map((event) => event.data)).toEqual([{ ...f.entries[0], type: 'session', instructions: expect.any(String) }, ...f.entries.slice(1)])
    expect(events.map((event) => event.seq)).toEqual([1, 2, 3, 4])
    expect(events[1].turnId).toBe(events[3].turnId)
    expect(JSON.parse(readFileSync(f.code, 'utf8'))).toMatchObject({ kitaSession: 'a', project: 'binos', pinned: true, scanned: 4, prs: ['pr'] })
    expect(readFileSync(path.join(f.target, 'files/a.png'), 'utf8')).toBe('exact-image-bytes')
    expect(JSON.parse(readFileSync(path.join(f.target, 'runtime.json'), 'utf8')).workerDir).toBe(path.join(f.old, 'host'))
    expect(readFileSync(path.join(f.old, 'items.jsonl'))).toEqual(before)
    const after = readFileSync(path.join(f.target, 'events.jsonl'))
    migrateAgentToKita(f.root)
    expect(readFileSync(path.join(f.target, 'events.jsonl'))).toEqual(after)
  })

  it('发现损坏或断开的引用时停止，正式引用和原数据都不改', () => {
    const f = fixture()
    const before = readFileSync(f.code)
    writeFileSync(path.join(f.old, 'items.jsonl'), '{broken}\n')
    expect(() => migrateAgentToKita(f.root)).toThrow('损坏记录')
    expect(existsSync(path.join(f.root, 'Library/Services/kita'))).toBe(false)
    expect(readFileSync(f.code)).toEqual(before)
    expect(JSON.parse(readFileSync(path.join(f.root, 'Library/binos/data-revision.json'), 'utf8')).revision).toBe('kita-sessions-v1')
    const g = fixture()
    writeFileSync(g.code, '{"thread":"missing"}')
    expect(() => migrateAgentToKita(g.root)).toThrow('引用不完整')
    expect(JSON.parse(readFileSync(g.code, 'utf8'))).toEqual({ thread: 'missing' })
  })

  it('迁移中断后源记录又被写入时拒绝使用过期备份', () => {
    const f = fixture()
    writeFileSync(f.code, '{"thread":"missing"}')
    expect(() => migrateAgentToKita(f.root)).toThrow('引用不完整')
    writeFileSync(path.join(f.old, 'items.jsonl'), readFileSync(path.join(f.old, 'items.jsonl'), 'utf8') + '{}\n')
    expect(() => migrateAgentToKita(f.root)).toThrow('备份校验失败')
    expect(existsSync(path.join(f.root, 'Library/Services/kita'))).toBe(false)
  })

  it('发布中断后从已验证的备份和发布记录继续，不重复转换、不依赖改过的引用', () => {
    const f = fixture()
    const original = readFileSync(f.code)
    migrateAgentToKita(f.root)
    const target = path.join(f.root, 'Library/Services/kita')
    const snapshot = readFileSync(path.join(f.target, 'events.jsonl'))
    // 模拟目录发布之前崩溃：发布记录已有，staged 还未 rename。
    cpSync(target, path.join(f.migration, 'staged'), { recursive: true })
    rmSync(target, { recursive: true })
    rmSync(path.join(f.migration, 'completed.json'))
    writeFileSync(f.code, original)
    migrateAgentToKita(f.root)
    expect(readFileSync(path.join(f.target, 'events.jsonl'))).toEqual(snapshot)
    // 模拟目录已发布、引用只改了一部分时崩溃。
    rmSync(path.join(f.migration, 'completed.json'))
    writeFileSync(f.code, original)
    migrateAgentToKita(f.root)
    expect(JSON.parse(readFileSync(f.code, 'utf8')).kitaSession).toBe('a')
    expect(readFileSync(path.join(f.target, 'events.jsonl'))).toEqual(snapshot)
  })
})

import type { JsonValue, StateChange, StateEntry } from '@binos/server/types'

// 系统状态在页面里的副本。快照和推送走两条连接，到达的先后不确定，所以逐项比较版本号，只接受更新的值。
// 删除的项留一条 value 为 null 的记录，免得更早的快照又把它加回来。
// 本地写入立刻生效；请求返回前，这一项来自后端的值先记下不用，返回后和本地写入比较版本号，取更新的那个

type Item = { value: JsonValue; version: number }
// previous：第一次本地写入前的值，写入失败时恢复它
type Pending = { count: number; value: JsonValue; version: number; failed: boolean; previous?: Item; remote?: Item }

export class StateStore {
  private items = new Map<string, Item>()
  private pending = new Map<string, Pending>()
  // 最近一次快照的版本：不在 items 里的项，在这个版本之前的推送都已经过时
  private base = 0
  private listeners = new Set<() => void>()
  private cache = new Map<string, { revision: number; entries: [string, JsonValue][] }>()
  private revision = 0
  loaded = false

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  get(key: string): JsonValue {
    return this.items.get(key)?.value ?? null
  }

  // 以 prefix 开头的项，按键排序。内容不变时返回同一个数组
  list(prefix: string): [string, JsonValue][] {
    const cached = this.cache.get(prefix)
    if (cached?.revision === this.revision) {
      return cached.entries
    }
    const entries = [...this.items]
      .filter(([key, item]) => key.startsWith(prefix) && item.value !== null)
      .map(([key, item]): [string, JsonValue] => [key, item.value])
      .sort(([a], [b]) => (a < b ? -1 : 1))
    this.cache.set(prefix, { revision: this.revision, entries })
    return entries
  }

  applySnapshot(version: number, entries: StateEntry[]) {
    const snapshot = new Map(entries.map((entry) => [entry.key, entry.value]))
    for (const key of new Set([...this.items.keys(), ...snapshot.keys()])) {
      this.receive(key, snapshot.get(key) ?? null, version)
    }
    this.base = Math.max(this.base, version)
    this.loaded = true
    this.changed()
  }

  applyRemote(version: number, changes: StateChange[]) {
    for (const { key, value } of changes) {
      this.receive(key, value, version)
    }
    this.changed()
  }

  writeLocal(changes: StateChange[]) {
    for (const { key, value } of changes) {
      const pending = this.pending.get(key)
      if (pending) {
        pending.count += 1
        pending.value = value
      } else {
        this.pending.set(key, { count: 1, value, version: 0, failed: false, previous: this.items.get(key) })
      }
      this.items.set(key, { value, version: this.items.get(key)?.version ?? this.base })
    }
    this.changed()
  }

  // version 为 undefined 表示写入失败；返回 true 时调用方应重新读取快照
  settleLocal(changes: StateChange[], version: number | undefined): boolean {
    let failed = false
    for (const { key } of changes) {
      const pending = this.pending.get(key)
      if (!pending) {
        continue
      }
      pending.count -= 1
      if (version === undefined) {
        pending.failed = true
      } else {
        pending.version = Math.max(pending.version, version)
      }
      if (pending.count > 0) {
        continue
      }
      this.pending.delete(key)
      failed ||= pending.failed
      const { remote, previous } = pending
      if (remote && (pending.failed || remote.version > pending.version)) {
        this.items.set(key, remote)
      } else if (!pending.failed) {
        this.items.set(key, { value: pending.value, version: pending.version })
      } else if (previous) {
        this.items.set(key, previous)
      } else {
        this.items.delete(key)
      }
    }
    this.changed()
    return failed
  }

  private receive(key: string, value: JsonValue, version: number) {
    const pending = this.pending.get(key)
    if (pending) {
      if (!pending.remote || version > pending.remote.version) {
        pending.remote = { value, version }
      }
      return
    }
    const current = this.items.get(key)?.version ?? this.base
    if (version > current) {
      this.items.set(key, { value, version })
    }
  }

  private changed() {
    this.revision += 1
    this.listeners.forEach((listener) => listener())
  }
}

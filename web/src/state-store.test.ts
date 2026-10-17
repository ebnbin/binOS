import { describe, expect, it } from 'vitest'
import { StateStore } from './state-store.ts'

const loaded = (version: number, entries: Record<string, unknown>) => {
  const store = new StateStore()
  store.applySnapshot(version, Object.entries(entries).map(([key, value]) => ({ key, value: value as never, version })))
  return store
}

describe('StateStore', () => {
  it('快照和推送谁先到都一样：旧的不会盖掉新的，删除也不会被旧快照加回来', () => {
    const store = loaded(1, { a: 1, b: 1 })
    store.applyRemote(3, [{ key: 'a', value: 3 }, { key: 'b', value: null }])
    store.applySnapshot(2, [{ key: 'a', value: 2, version: 2 }, { key: 'b', value: 2, version: 2 }, { key: 'c', value: 2, version: 2 }])
    expect([store.get('a'), store.get('b'), store.get('c')]).toEqual([3, null, 2])
    // 快照之后才到的旧推送
    store.applyRemote(2, [{ key: 'c', value: 'old' }, { key: 'd', value: 'old' }])
    expect([store.get('c'), store.get('d')]).toEqual([2, null])
  })

  it('本地写入等待返回时，后端的值按版本号和它比较', () => {
    const store = loaded(1, { a: 0, b: 0 })
    store.writeLocal([{ key: 'a', value: 'mine' }, { key: 'b', value: 'mine' }])
    expect(store.get('a')).toBe('mine')
    // 别的设备先于这次写入提交了 a，推送先到
    store.applyRemote(2, [{ key: 'a', value: 'older' }])
    // 这次写入的回声，以及别的设备在这次写入之后提交的 b
    store.applyRemote(3, [{ key: 'a', value: 'mine' }, { key: 'b', value: 'mine' }])
    store.applyRemote(4, [{ key: 'b', value: 'newer' }])
    expect([store.get('a'), store.get('b')]).toEqual(['mine', 'mine'])
    expect(store.settleLocal([{ key: 'a', value: 'mine' }, { key: 'b', value: 'mine' }], 3)).toBe(false)
    expect([store.get('a'), store.get('b')]).toEqual(['mine', 'newer'])
  })

  it('写入失败时恢复原来的值，并要求重新读取快照', () => {
    const store = loaded(1, { a: 0 })
    store.writeLocal([{ key: 'a', value: 1 }, { key: 'new', value: 1 }])
    expect(store.settleLocal([{ key: 'a', value: 1 }, { key: 'new', value: 1 }], undefined)).toBe(true)
    expect([store.get('a'), store.get('new')]).toEqual([0, null])
    // 重新读取到的快照版本没有变化，也照样生效
    store.applySnapshot(1, [{ key: 'a', value: 0, version: 1 }])
    expect(store.get('a')).toBe(0)
  })

  it('内容不变时 list 返回同一个数组', () => {
    const store = loaded(1, { 'w/2': 2, 'w/1': 1, x: 0 })
    const first = store.list('w/')
    expect(first).toEqual([['w/1', 1], ['w/2', 2]])
    expect(store.list('w/')).toBe(first)
    store.applyRemote(2, [{ key: 'w/1', value: null }])
    expect(store.list('w/')).toEqual([['w/2', 2]])
  })
})

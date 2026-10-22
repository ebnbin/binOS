import { afterEach, describe, expect, it, vi } from 'vitest'
import { MusicController } from './controller.ts'
import { executePlayerCommand, playerState } from './playerCommands.ts'
import type { PlayerEvent } from './types.ts'

const track = { ref: { provider: 'test', id: 'a' }, title: 'A', artists: [], externalUrl: 'https://example.com/a' }
function setup() {
  let emit: (event: PlayerEvent) => void = () => {}
  const music = new MusicController((_ref, callback) => {
    emit = callback
    return { load: async () => {}, play: () => {}, pause: () => {}, seek: () => {}, setVolume: () => {}, destroy: () => {} }
  })
  music.add([track])
  return { music, emit: (event: PlayerEvent) => emit(event), signal: new AbortController().signal }
}
afterEach(() => vi.useRealTimers())

describe('远程播放确认', () => {
  it('等待实际 playing 事件，不能把加载完成当作播放成功', async () => {
    const { music, emit, signal } = setup()
    let settled = false
    const done = executePlayerCommand(music, { type: 'play' }, signal).then(() => { settled = true })
    await Promise.resolve()
    expect(settled).toBe(false)
    expect(playerState(music).status).toBe('loading')
    emit({ status: 'playing' })
    await done
    expect(settled).toBe(true)
  })

  it('恢复暂停的曲目时等待新的 playing 事件', async () => {
    const { music, emit, signal } = setup()
    await music.select(0)
    emit({ status: 'playing' })
    music.pause()
    const done = executePlayerCommand(music, { type: 'play' }, signal)
    expect(music.getSnapshot().status).toBe('loading')
    emit({ status: 'playing' })
    await done
  })

  it('加载失败、用户中断、断线和自动播放超时返回失败', async () => {
    for (const failure of ['error', 'pause', 'disconnect', 'timeout']) {
      vi.useFakeTimers()
      const { music, emit } = setup()
      const controller = new AbortController()
      const done = executePlayerCommand(music, { type: 'play' }, controller.signal)
      const failed = done.catch(error => error)
      if (failure === 'error') emit({ status: 'error', error: 'Blocked' })
      if (failure === 'pause') music.pause()
      if (failure === 'disconnect') controller.abort()
      if (failure === 'timeout') await vi.advanceTimersByTimeAsync(10000)
      expect(await failed).toBeInstanceOf(Error)
    }
  })

  it('按稳定曲目引用选择歌曲，拒绝缺失曲目和不支持的控制', async () => {
    const { music, signal } = setup()
    await expect(executePlayerCommand(music, { type: 'select', ref: { provider: 'test', id: 'missing' } }, signal)).rejects.toThrow('不在共享队列')
    await expect(executePlayerCommand(music, { type: 'seek', positionMs: 10 }, signal)).rejects.toThrow('不可调整进度')
    await executePlayerCommand(music, { type: 'volume', volume: 0.2 }, signal)
    await executePlayerCommand(music, { type: 'repeat', repeat: 'all' }, signal)
    expect(playerState(music)).toMatchObject({ volume: 0.2, repeat: 'all' })
  })
})

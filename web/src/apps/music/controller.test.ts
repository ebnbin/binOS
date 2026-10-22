import { describe, expect, it, vi } from 'vitest'
import { MusicController, restoreMusic } from './controller.ts'
import type { MusicPlayer, PlayerEvent, Track } from './types.ts'

const track = (id: string, provider = 'audio'): Track => ({ ref: { provider, id }, title: id, artists: ['Artist'], externalUrl: `https://example.com/${id}` })

function setup(pending = false) {
  const engines: { player: MusicPlayer; emit(event: PlayerEvent): void; ready(): void }[] = []
  const createPlayer = (_ref: Track['ref'], emit: (event: PlayerEvent) => void): MusicPlayer => {
    let ready = () => {}
    const player: MusicPlayer = {
      load: vi.fn<MusicPlayer['load']>(() => pending ? new Promise<void>((resolve) => { ready = resolve }) : Promise.resolve()),
      play: vi.fn<MusicPlayer['play']>(), pause: vi.fn<MusicPlayer['pause']>(), seek: vi.fn<MusicPlayer['seek']>(), setVolume: vi.fn<MusicPlayer['setVolume']>(), destroy: vi.fn<MusicPlayer['destroy']>(),
    }
    engines.push({ player, emit, ready: () => ready() })
    return player
  }
  return { engines, music: new MusicController(createPlayer) }
}

describe('音乐播放会话', () => {
  it('快速切换来源后，旧加载和迟到的结束事件不会抢回播放或跳过曲目', async () => {
    const { music, engines } = setup(true)
    music.add([track('first'), track('second', 'other'), track('third')])
    const first = music.select(0)
    const second = music.select(1)
    engines[0].ready()
    await first
    expect(engines[0].player.play).not.toHaveBeenCalled()
    expect(engines[0].player.destroy).toHaveBeenCalledOnce()
    engines[0].emit({ status: 'ended' })
    expect(music.getSnapshot().index).toBe(1)
    engines[1].ready()
    await second
    expect(engines[1].player.play).toHaveBeenCalledOnce()
  })

  it('加载期间暂停，播放器就绪后不会自行播放', async () => {
    const { music, engines } = setup(true)
    music.add([track('a')])
    const loading = music.select(0)
    music.pause()
    engines[0].ready()
    await loading
    expect(engines[0].player.play).not.toHaveBeenCalled()
    expect(music.getSnapshot().status).toBe('paused')
    music.toggle()
    expect(engines[0].player.play).toHaveBeenCalledOnce()
  })

  it('系统播放指令不会暂停正在加载的曲目，进度事件保留播放错误提示', async () => {
    const { music, engines } = setup(true)
    music.add([track('a')])
    const loading = music.select(0)
    music.play()
    expect(music.getSnapshot().status).toBe('loading')
    engines[0].ready()
    await loading
    engines[0].emit({ status: 'paused', error: '需要再次点击播放' })
    engines[0].emit({ positionMs: 0, durationMs: 1000 })
    expect(music.getSnapshot().error).toBe('需要再次点击播放')
    music.play()
    expect(music.getSnapshot().error).toBeUndefined()
  })

  it('暂停后的缓冲、迟到播放和结束事件不会恢复播放或自动切歌', async () => {
    const { music, engines } = setup()
    music.add([track('a'), track('b')])
    await music.select(0)
    music.pause()
    engines[0].emit({ status: 'loading' })
    expect(music.getSnapshot().status).toBe('paused')
    engines[0].emit({ status: 'playing' })
    expect(engines[0].player.pause).toHaveBeenCalledTimes(2)
    expect(music.getSnapshot().status).toBe('paused')
    engines[0].emit({ status: 'ended' })
    expect(music.getSnapshot().index).toBe(0)
    expect(engines).toHaveLength(1)
  })

  it('只有当前曲目结束才自动续播，顺序播放在队尾停止', async () => {
    const { music, engines } = setup()
    music.add([track('a'), track('b')])
    await music.select(0)
    engines[0].emit({ status: 'ended' })
    await Promise.resolve()
    expect(music.getSnapshot().index).toBe(1)
    engines[1].emit({ status: 'error', error: 'unavailable' })
    expect(music.getSnapshot().index).toBe(1)
    engines[1].emit({ status: 'ended' })
    expect(music.getSnapshot().status).toBe('ended')
    expect(engines).toHaveLength(2)
  })

  it('循环模式在队尾重新开始，单曲循环保持当前曲目', async () => {
    const { music, engines } = setup()
    music.add([track('a'), track('b')])
    music.cycleRepeat()
    await music.select(1)
    engines[0].emit({ status: 'ended' })
    await Promise.resolve()
    expect(music.getSnapshot().index).toBe(0)
    music.cycleRepeat()
    engines[1].emit({ status: 'ended' })
    await Promise.resolve()
    expect(music.getSnapshot().index).toBe(0)
    expect(engines).toHaveLength(3)
  })

  it('删除前面的曲目保持当前播放，清空后旧事件不再恢复播放状态', async () => {
    const { music, engines } = setup()
    music.add([track('a'), track('b')])
    await music.select(1)
    engines[0].emit({ status: 'playing' })
    music.remove(0)
    expect(music.getSnapshot().index).toBe(0)
    expect(engines[0].player.destroy).not.toHaveBeenCalled()
    music.clear()
    engines[0].emit({ status: 'playing' })
    expect(music.getSnapshot()).toMatchObject({ queue: [], index: -1, status: 'idle' })
  })

  it('同名不同来源曲目不会合并；恢复队列不自动播放，也不恢复失效状态', () => {
    const { music } = setup()
    music.add([track('a'), track('a'), track('a', 'other')])
    expect(music.getSnapshot().queue).toHaveLength(2)
    expect(restoreMusic({ ...music.getSnapshot(), index: 100, status: 'playing', volume: NaN })).toMatchObject({ index: 1, status: 'idle', volume: 0.7 })
    expect(restoreMusic({ queue: [null, {}, track('a')], index: -5 }).queue).toHaveLength(1)
  })
})

it('远程队列更新保留当前歌曲和播放器，当前歌曲被移除时停止播放', async () => {
  const { music, engines } = setup()
  music.add([track('a'), track('b')])
  await music.select(1)
  engines[0].emit({ status: 'playing', positionMs: 12000 })
  music.replaceQueue([track('c'), track('b'), track('a')])
  expect(music.getSnapshot()).toMatchObject({ index: 1, status: 'playing', positionMs: 12000 })
  expect(engines[0].player.destroy).not.toHaveBeenCalled()
  music.replaceQueue([track('a')])
  expect(engines[0].player.destroy).toHaveBeenCalledOnce()
  expect(music.getSnapshot()).toMatchObject({ index: 0, status: 'idle' })
})

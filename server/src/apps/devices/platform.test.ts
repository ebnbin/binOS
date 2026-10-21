import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'

const { execute, controls } = vi.hoisted(() => ({
  execute: vi.fn<(command: string, args: string[]) => Promise<{ stdout: string | Buffer }>>(),
  controls: { empty: false, other: false, capture: '', iosState: 'Booted' },
}))
vi.mock('node:child_process', async (original) => ({
  ...await original<typeof import('node:child_process')>(),
  execFile: Object.assign(() => {}, { [Symbol.for('nodejs.util.promisify.custom')]: execute }),
}))
const root = mkdtempSync(path.join(os.tmpdir(), 'binos-platform-'))
process.env.BINOS_ROOT = root
process.env.BINOS_DEVICES_MODE = 'real'
const { screenshot, reset } = await import('./platform.js')
const png = Buffer.from('89504e470d0a1a0a', 'hex')
execute.mockImplementation(async (_command, args) => {
  if (args.includes('list')) return { stdout: JSON.stringify({ devices: { runtime: [{ udid: 'ios-id', name: 'iPhone', state: controls.iosState }] } }) }
  if (args.includes('shutdown')) { controls.iosState = 'Shutdown'; throw new Error('设备已经 Shutdown') }
  if (args.includes('erase') || args.includes('bootstatus')) return { stdout: '' }
  if (args.includes('boot')) { controls.iosState = 'Booted'; return { stdout: '' } }
  if (args.includes('getenv')) return { stdout: 'ios-id' }
  if (args.includes('screenshot')) { controls.capture = args.at(-1)!; writeFileSync(controls.capture, controls.empty ? Buffer.alloc(0) : png); return { stdout: '' } }
  if (args.includes('name')) return { stdout: `${controls.other ? 'AnotherDevice' : 'Android'}\r\nOK\r\n` }
  if (args.includes('getprop')) return { stdout: '1' }
  if (args.includes('screencap')) return { stdout: controls.empty ? Buffer.alloc(0) : png }
  throw new Error('未预期的设备命令')
})
afterAll(() => rmSync(root, { recursive: true, force: true }))

describe('平台操作', () => {
  it('iOS 查询后已经关闭的竞态不会阻止恢复清理', async () => {
    await expect(reset({ id: 'ios', platform: 'ios', name: 'iPhone', target: 'ios-id', status: 'cleaning' })).resolves.toBeUndefined()
    expect(controls.iosState).toBe('Booted')
  })
  it('iOS 从临时文件读取 PNG，始终清理临时内容，拒绝空截图', async () => {
    const device = { id: 'ios', platform: 'ios' as const, name: 'iPhone', target: 'ios-id', status: 'free' as const }
    expect((await screenshot(device)).image).toBe(png.toString('base64'))
    expect(existsSync(controls.capture)).toBe(false)
    controls.empty = true
    await expect(screenshot(device)).rejects.toThrow('截图未生成有效 PNG')
    expect(existsSync(controls.capture)).toBe(false)
    controls.empty = false
  })
  it('ADB 名称的 CRLF 不影响归属核对，空输出不会作为成功截图返回', async () => {
    const device = { id: 'android', platform: 'android' as const, name: 'Android', target: 'emulator-5560', status: 'free' as const }
    expect((await screenshot(device)).image).toBe(png.toString('base64'))
    controls.empty = true
    await expect(screenshot(device)).rejects.toThrow('截图未生成有效 PNG')
    controls.empty = false
    controls.other = true
    await expect(screenshot(device)).rejects.toThrow('设备端口由其他模拟器使用')
    controls.other = false
  })
})

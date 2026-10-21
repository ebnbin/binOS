import { execFile, spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { closeSync, existsSync, openSync } from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { setTimeout as sleep } from 'node:timers/promises'
import { adb, avdDir, emulator, emulatorHome, emulatorTmp, iosSet, javaHome, mode, sdkDir, toolEnv } from './config.js'
import type { Device, ObservedDevice, Platform } from './types.js'

const exec = promisify(execFile)
export async function tool(command: string, args: string[], timeout = 30_000) {
  const { stdout } = await exec(command, args, { env: toolEnv, timeout, maxBuffer: 24 * 1024 * 1024 })
  return stdout.trim()
}
const sim = (args: string[], timeout?: number) => tool('xcrun', ['simctl', '--set', iosSet, ...args], timeout)
type SimDevice = { udid: string; name: string; state: string; isAvailable?: boolean }
const parseIos = (text: string) => Object.values((JSON.parse(text) as { devices: Record<string, SimDevice[]> }).devices).flat()

export async function discover(): Promise<{ observed: ObservedDevice[]; discoveryErrors: string[] }> {
  if (mode === 'mock') return { observed: [], discoveryErrors: [] }
  const sources = await Promise.allSettled([
    tool('xcrun', ['simctl', 'list', 'devices', 'available', '--json']).then((text) => parseIos(text).map((d) => ({ platform: 'ios' as const, name: d.name, target: d.udid, state: d.state }))),
    tool(adb, ['devices']).then(async (text) => Promise.all(text.split('\n').slice(1).filter((line) => /^emulator-\d+\s+device/.test(line)).map(async (line) => {
      const target = line.split(/\s/)[0]
      const name = (await tool(adb, ['-s', target, 'emu', 'avd', 'name'])).split(/\r?\n/)[0].trim()
      return { platform: 'android' as const, name, target, state: 'Booted' }
    }))),
  ])
  return {
    observed: sources.flatMap<ObservedDevice>((result) => result.status === 'fulfilled' ? result.value : []),
    discoveryErrors: sources.flatMap((result, index) => result.status === 'rejected' ? [`${index === 0 ? 'iOS' : 'Android'} 查询失败：${message(result.reason)}`] : []),
  }
}
export const message = (error: unknown) => error instanceof Error ? error.message.slice(0, 600) : String(error).slice(0, 600)

class OwnershipError extends Error {}
async function ownedAndroid(device: Device) {
  const name = (await tool(adb, ['-s', device.target, 'emu', 'avd', 'name'])).split(/\r?\n/)[0].trim()
  if (!name || name === 'OK' || name.startsWith('KO:')) throw new Error('模拟器正在切换状态，暂时无法核对名称')
  if (name !== device.name) throw new OwnershipError('设备端口由其他模拟器使用，已拒绝操作')
}
export async function health(device: Device) {
  if (mode === 'mock') return
  if (device.platform === 'android') {
    await ownedAndroid(device)
    if (await tool(adb, ['-s', device.target, 'shell', 'getprop', 'sys.boot_completed'], 10_000) !== '1') throw new Error('Android 尚未完成启动')
  } else {
    const found = parseIos(await sim(['list', 'devices', '--json'])).find((item) => item.udid === device.target && item.name === device.name)
    if (!found || found.state !== 'Booted') throw new Error('iOS 设备尚未启动或不存在')
    await sim(['getenv', device.target, 'SIMULATOR_UDID'], 10_000)
  }
}

async function bootAndroid(device: Device, wipe: boolean) {
  const port = device.target.replace('emulator-', '')
  const config = await readFile(path.join(avdDir, `${device.name}.avd`, 'config.ini'), 'utf8')
  const target = /^target\s*=\s*(.+)$/m.exec(config)?.[1].trim()
  if (!target) throw new Error('受管理 AVD 缺少系统版本')
  await writeFile(path.join(avdDir, `${device.name}.ini`), `avd.ini.encoding=UTF-8\npath=${path.join(avdDir, `${device.name}.avd`)}\ntarget=${target}\n`)
  // 端口被外部设备占用时不能启动或清理，避免误操作另一个设备池。
  let available = false
  for (let attempt = 0; attempt < 30; attempt++) {
    available = await new Promise<boolean>((resolve) => {
      const server = net.createServer()
      server.once('error', () => resolve(false))
      server.listen(Number(port), '127.0.0.1', () => server.close(() => resolve(true)))
    })
    if (available) break
    await sleep(1000)
  }
  if (!available) throw new Error(`端口 ${port} 正在使用，请先确认设备归属`)
  await mkdir(emulatorHome, { recursive: true })
  await mkdir(emulatorTmp, { recursive: true })
  const log = openSync(path.join(emulatorHome, `${device.id}.log`), 'a', 0o600)
  const child = spawn(emulator, ['-avd', device.name, '-port', port, '-no-window', '-no-audio', '-no-snapshot', '-no-metrics', ...(wipe ? ['-wipe-data'] : [])], {
    env: { ...toolEnv, ANDROID_EMULATOR_HOME: emulatorHome, TMPDIR: emulatorTmp }, stdio: ['ignore', log, log], detached: true,
  })
  closeSync(log)
  let failed: Error | undefined
  child.on('error', (error) => { failed = error })
  child.unref()
  for (let attempt = 0; attempt < 150; attempt++) {
    if (failed) throw failed
    if (child.exitCode !== null) throw new Error(`Android 模拟器退出：${child.exitCode}`)
    try { await health(device); return } catch { /* 启动阶段等待设备就绪。 */ }
    await sleep(2000)
  }
  throw new Error('Android 启动超过 5 分钟，设备已隔离')
}
export async function reset(device: Device) {
  if (mode === 'mock') { await sleep(100); return }
  if (device.platform === 'ios') {
    const found = parseIos(await sim(['list', 'devices', '--json'])).find((item) => item.udid === device.target && item.name === device.name)
    if (!found) throw new Error('受管理的 iOS 设备不存在')
    for (let attempt = 0; attempt < 30; attempt++) {
      const current = parseIos(await sim(['list', 'devices', '--json'])).find((item) => item.udid === device.target)
      if (current?.state === 'Shutdown') break
      try { await sim(['shutdown', device.target], 60_000) }
      catch (error) { if (attempt === 29) throw error }
      await sleep(1000)
    }
    await sim(['erase', device.target], 120_000)
    try { await sim(['boot', device.target], 60_000) }
    catch (error) {
      const current = parseIos(await sim(['list', 'devices', '--json'])).find((item) => item.udid === device.target)
      if (current?.state !== 'Booted' && current?.state !== 'Booting') throw error
    }
    await sim(['bootstatus', device.target, '-b'], 300_000)
  } else {
    let stopping = false
    for (let attempt = 0; attempt < 30; attempt++) {
      const devices = await tool(adb, ['devices'])
      if (!devices.split('\n').some((line) => line.startsWith(`${device.target}\t`))) break
      try {
        await ownedAndroid(device)
        if (!stopping) { await tool(adb, ['-s', device.target, 'emu', 'kill']); stopping = true }
      } catch (error) {
        if (error instanceof OwnershipError || attempt === 29) throw error
      }
      await sleep(1000)
    }
    await bootAndroid(device, true)
  }
  await health(device)
}

export async function provision(platform: Platform, id: string, source: string, runtime: string | undefined, port: number): Promise<Device> {
  const name = `binos-${id}`
  if (mode === 'mock') return { id, platform, name, target: platform === 'ios' ? id : `emulator-${port}`, status: 'cleaning' }
  if (platform === 'ios') {
    if (!source.startsWith('com.apple.CoreSimulator.SimDeviceType.') || !runtime?.startsWith('com.apple.CoreSimulator.SimRuntime.')) throw new Error('需要明确的 iOS device type 和 runtime 标识')
    await mkdir(iosSet, { recursive: true })
    const target = await sim(['create', name, source, runtime], 120_000)
    return { id, platform, name, target, system: runtime, status: 'cleaning' }
  }
  if (!/^[\w-]{1,100}$/.test(source)) throw new Error('Android 来源必须是已有 AVD 的名称')
  const sourceDir = process.env.BINOS_ANDROID_SOURCE_AVDS ?? path.join(os.homedir(), '.android', 'avd')
  const config = await readFile(path.join(sourceDir, `${source}.avd`, 'config.ini'), 'utf8')
  const entries = config.split('\n').map((line) => { const at = line.indexOf('='); return at < 0 ? line : `${line.slice(0, at).trim()}=${line.slice(at + 1).trim()}` }).filter((line) => /^(hw\.|image\.sysdir\.1=|tag\.|abi\.type=|PlayStore\.enabled=|target=|skin\.name=)/.test(line) && !line.split('=')[0].endsWith('.path'))
  const image = entries.find((line) => line.startsWith('image.sysdir.1='))?.split('=').slice(1).join('=').trim()
  if (!image || !existsSync(path.resolve(sdkDir, image))) throw new Error('来源 AVD 的系统镜像未安装')
  const directory = path.join(avdDir, `${name}.avd`)
  await mkdir(directory, { recursive: true })
  await writeFile(path.join(directory, 'config.ini'), `${entries.join('\n')}\nAvdId=${name}\navd.ini.displayname=${name}\n`)
  const system = entries.find((line) => line.startsWith('target='))?.slice('target='.length)
  if (!system) throw new Error('来源 AVD 缺少 target 版本')
  await writeFile(path.join(avdDir, `${name}.ini`), `avd.ini.encoding=UTF-8\npath=${directory}\ntarget=${system}\n`)
  return { id, platform, name, target: `emulator-${port}`, system, status: 'cleaning' }
}
export async function screenshot(device: Device) {
  if (mode === 'mock') {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="390" height="780"><rect width="390" height="780" rx="32" fill="#f3f2ef"/><text x="195" y="350" text-anchor="middle" font-family="sans-serif" font-size="28">binOS Devices</text><text x="195" y="395" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#777">模拟设备 · 预览</text></svg>'
    return { image: Buffer.from(svg).toString('base64'), mime: 'image/svg+xml', at: Date.now() }
  }
  await health(device)
  let png: Buffer
  if (device.platform === 'android') {
    const { stdout } = await exec(adb, ['-s', device.target, 'exec-out', 'screencap', '-p'], { env: toolEnv, encoding: 'buffer', timeout: 30_000, maxBuffer: 24 * 1024 * 1024 })
    png = stdout
  } else {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'binos-device-capture-'))
    try {
      const file = path.join(directory, 'screen.png')
      await sim(['io', device.target, 'screenshot', '--type=png', file])
      if ((await stat(file)).size > 24 * 1024 * 1024) throw new Error('截图超过 24 MiB')
      png = await readFile(file)
    } finally { await rm(directory, { recursive: true, force: true }) }
  }
  if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('截图未生成有效 PNG，请稍后重试')
  return { image: png.toString('base64'), mime: 'image/png', at: Date.now() }
}
export function deviceEnv(devices: Device[]) {
  const android = devices.find((device) => device.platform === 'android')
  const ios = devices.find((device) => device.platform === 'ios')
  return { ANDROID_HOME: sdkDir, ANDROID_AVD_HOME: avdDir, BINOS_IOS_DEVICE_SET: iosSet,
    ...(javaHome && { JAVA_HOME: javaHome }),
    PATH: [javaHome && path.join(javaHome, 'bin'), path.join(sdkDir, 'platform-tools'), path.join(sdkDir, 'emulator'), process.env.PATH].filter(Boolean).join(path.delimiter),
    ...(android && { ANDROID_SERIAL: android.target, BINOS_ANDROID_AVD: android.name }), ...(ios && { BINOS_IOS_UDID: ios.target }) }
}

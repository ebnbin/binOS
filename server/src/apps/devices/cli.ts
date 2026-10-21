import { writeFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import { deviceRequest } from './client.js'
import { platforms } from './protocol.js'
import type { LeaseResult, Snapshot } from './types.js'

const argv = process.argv.slice(2)
const command = argv.shift()
const separator = argv.indexOf('--')
const options = separator < 0 ? argv : argv.slice(0, separator)
const flag = (name: string) => { const at = options.indexOf(`--${name}`); return at >= 0 ? options[at + 1] : undefined }
const owner = flag('session') ?? process.env.BINOS_THREAD_ID
const identity = () => { if (!owner) throw new Error('需要 BINOS_THREAD_ID 或 --session <身份>'); return owner }
const lease = () => { const value = flag('lease'); if (!value) throw new Error('需要 --lease <申请返回的租约 ID>'); return value }
const print = (value: unknown) => console.log(JSON.stringify(value, null, 2))

try {
  switch (command) {
    case 'serve': await import('./daemon.js'); break
    case 'status': print(await deviceRequest({ action: 'status' })); break
    case 'discover': print(await deviceRequest({ action: 'discover' })); break
    case 'stop': print(await deviceRequest({ action: 'stop' })); break
    case 'acquire': {
      const selected = platforms(flag('platform') ?? 'both')
      const seconds = Number(flag('wait') ?? 0)
      if (!Number.isFinite(seconds) || seconds < 0 || seconds > 600) throw new Error('--wait 范围为 0 到 600 秒')
      const until = Date.now() + seconds * 1000
      let result: LeaseResult
      let pending = true
      do {
        result = await deviceRequest<LeaseResult>({ action: 'acquire', owner: identity(), reason: flag('reason') ?? '', platforms: selected })
        if (result.lease || Date.now() >= until) break
        await sleep(2000)
        pending = Date.now() <= until
      } while (pending)
      print(result)
      if (!result.lease) process.exitCode = 2
      break
    }
    case 'renew': case 'release': print(await deviceRequest({ action: command, owner: identity(), lease: lease() })); break
    case 'cancel': print(await deviceRequest({ action: 'cancel', owner: identity() })); break
    case 'maintenance': case 'restore':
      print(await deviceRequest({ action: 'control', device: argv[0], operation: command === 'maintenance' ? 'maintenance' : 'restore' })); break
    case 'screenshot': {
      const result = await deviceRequest<{ image: string; mime: string; at: number }>({ action: 'screenshot', device: argv[0], owner: identity(), lease: lease() })
      const output = flag('output')
      if (!output) throw new Error('需要 --output <截图文件>')
      writeFileSync(output, Buffer.from(result.image, 'base64'))
      print({ output, mime: result.mime, at: result.at })
      break
    }
    case 'provision': {
      const platform = platforms(flag('platform') ?? '')
      if (platform.length !== 1) throw new Error('每次只初始化一个平台')
      const source = flag('source')
      if (!source) throw new Error('需要 --source：Android AVD 名称或 iOS device type')
      print(await deviceRequest({ action: 'provision', platform: platform[0], source, runtime: flag('runtime') }))
      break
    }
    case 'run': {
      const at = argv.indexOf('--')
      if (at < 0 || !argv[at + 1]) throw new Error('用法：run --lease <id> -- <命令> [参数]')
      const result = await deviceRequest<{ code: number; stdout: string; stderr: string }>({ action: 'run', owner: identity(), lease: lease(), command: argv.slice(at + 1), cwd: process.cwd(), timeout: Number(flag('timeout') ?? 1800) * 1000 })
      process.stdout.write(result.stdout)
      process.stderr.write(result.stderr)
      process.exitCode = result.code
      break
    }
    case 'env': {
      const status = await deviceRequest<LeaseResult>({ action: 'renew', owner: identity(), lease: lease() })
      print(status.env)
      break
    }
    case 'log': { const status = await deviceRequest<Snapshot>({ action: 'status' }); print(status.events); break }
    default:
      console.log(`用法：binos devices <命令>
  status | discover | log              查看设备池、只读发现已有模拟器、操作记录
  acquire --platform android|ios|both [--reason 用途] [--wait 秒]
  renew | release --lease <id>          续租或释放，释放后自动清理
  cancel                               取消排队
  env --lease <id>                      输出设备环境变量 JSON
  run --lease <id> [--timeout 秒] -- <命令> [参数]
  screenshot <设备ID> --lease <id> --output <文件>
  maintenance | restore <设备ID>       停用或恢复空闲设备
  provision --platform android --source <已有AVD名称>
  provision --platform ios --source <device-type> --runtime <runtime-id>
  serve | stop                         运行或停止独立管理服务
身份默认使用 BINOS_THREAD_ID，手动操作加 --session <身份>。
服务按需启动；测试实例默认使用模拟设备。真实初始化只创建专属设备，不接管已有设备。
受管理命令自动保活，最长 30 分钟；其他操作间隔较长时使用 renew。`)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}

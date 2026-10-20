import { execFile } from 'node:child_process'
import { readFile, readdir, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { codeDir, isTestInstance } from '../../paths.js'
import { rootFromEnv, rootLayout } from '../../layout.js'
import { cpuUsage, parseNetwork, parseProcesses, parseService, parseSwap, parseThermal, parseVm, parseVolumes } from './parsers.js'
import type { Probe, Service, Snapshot } from './types.js'

const exec = promisify(execFile)
const layout = rootLayout(rootFromEnv())
const errorText = (error: unknown) => (error instanceof Error ? error.message.slice(0, 600) : String(error))
export async function command(file: string, args: string[] = []) {
  const { stdout, stderr } = await exec(file, args, { timeout: 5000, maxBuffer: 1024 * 1024, env: { ...process.env, LANG: 'en_US.UTF-8', LC_ALL: 'C' } })
  return stdout.trim() || stderr.trim()
}
async function probe(id: string, label: string, read: () => Promise<string>): Promise<Probe> {
  try {
    return { id, label, at: Date.now(), text: await read() }
  } catch (error) {
    return { id, label, at: Date.now(), error: errorText(error) }
  }
}

async function reports() {
  const dirs = [path.join(os.homedir(), 'Library/Logs/DiagnosticReports'), '/Library/Logs/DiagnosticReports']
  const results = await Promise.allSettled(
    dirs.map(async (dir) => {
      const names = (await readdir(dir)).filter((name) => /\.(ips|panic|crash|diag)$/.test(name))
      return Promise.all(
        names.map(async (name) => {
          const info = await stat(path.join(dir, name))
          return { name, at: info.mtimeMs }
        }),
      )
    }),
  )
  const entries = results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
  if (results.every((result) => result.status === 'rejected')) throw new Error('无法读取诊断报告目录')
  return (
    entries
      .sort((a, b) => b.at - a.at)
      .slice(0, 20)
      .map((item) => `${new Date(item.at).toISOString()}  ${item.name}`)
      .join('\n') || '没有可读取的诊断报告'
  )
}

const slowCommands: [string, string, string, string[]][] = [
  ['identity', '硬件与 macOS', '/usr/sbin/system_profiler', ['SPHardwareDataType', 'SPSoftwareDataType', '-detailLevel', 'mini']],
  ['sleep', '休眠与断电恢复设置', '/usr/bin/pmset', ['-g', 'custom']],
  ['assertions', '阻止休眠的进程', '/usr/bin/pmset', ['-g', 'assertions']],
  ['schedule', '计划开关机与唤醒', '/usr/bin/pmset', ['-g', 'sched']],
  ['smart', '启动磁盘与 SMART', '/usr/sbin/diskutil', ['info', '/']],
  ['batteryHealth', '电池与电源硬件', '/usr/sbin/system_profiler', ['SPPowerDataType', '-detailLevel', 'mini']],
  ['dns', 'DNS 配置', '/usr/sbin/scutil', ['--dns']],
  ['listeners', '监听中的 TCP 端口（当前用户可见）', '/usr/sbin/lsof', ['-nP', '-iTCP', '-sTCP:LISTEN']],
  ['users', '当前登录会话', '/usr/bin/who', []],
  ['route', '网络可达性', '/usr/sbin/scutil', ['--nwi']],
  ['backup', '最近的 Time Machine 备份', '/usr/bin/tmutil', ['latestbackup']],
  ['backupState', 'Time Machine 运行状态', '/usr/bin/tmutil', ['status']],
  ['filevault', 'FileVault', '/usr/bin/fdesetup', ['status']],
  ['sip', '系统完整性保护', '/usr/bin/csrutil', ['status']],
  ['gatekeeper', 'Gatekeeper', '/usr/sbin/spctl', ['--status']],
  ['firewall', '应用防火墙', '/usr/libexec/ApplicationFirewall/socketfilterfw', ['--getglobalstate']],
  ['reboots', '最近重启与关机记录', '/usr/bin/last', ['-10', 'reboot', 'shutdown']],
]

export class Collector {
  private previousCpu: { idle: number; total: number }[] = []
  private previousNet: { at: number; values: ReturnType<typeof parseNetwork> } | undefined
  private slow: Probe[] = []
  private slowAt = 0
  private model = os.machine()
  private chip = os.cpus()[0]?.model || '未知'
  private version = 'dev'
  private services: Service[] = []
  private deploymentFailure: string | undefined

  async collect(): Promise<Snapshot> {
    const started = Date.now()
    const slowDue = started - this.slowAt >= 60_000
    const fastSpecs: [string, string, string, string[]][] = [
      ['vm', '虚拟内存', '/usr/bin/vm_stat', []],
      ['swap', '交换空间', '/usr/sbin/sysctl', ['vm.swapusage']],
      ['pressure', '内存压力', '/usr/sbin/sysctl', ['-n', 'kern.memorystatus_vm_pressure_level']],
      ['volumes', '已挂载磁盘', '/bin/df', ['-kP']],
      ['traffic', '网络流量', '/usr/sbin/netstat', ['-ibn']],
      ['processes', '进程', '/bin/ps', ['-axo', 'pid=,ppid=,pcpu=,rss=,etime=,comm=']],
      ['power', '供电与电池', '/usr/bin/pmset', ['-g', 'batt']],
      ['thermal', '系统热状态', '/usr/bin/pmset', ['-g', 'therm']],
    ]
    const fastWork = Promise.all(fastSpecs.map(([id, label, file, args]) => probe(id, label, () => command(file, args))))
    const slowWork = slowDue ? this.collectSlow() : Promise.resolve()
    const [fast] = await Promise.all([fastWork, slowWork])
    const byId = Object.fromEntries(fast.map((result) => [result.id, result]))
    const parsed = <T>(id: string, parser: (text: string) => T, fallback: T): T => {
      const result = byId[id]
      if (result.text === undefined) return fallback
      try {
        return parser(result.text)
      } catch (error) {
        result.error = errorText(error)
        return fallback
      }
    }
    const vm = parsed('vm', parseVm, { cached: null, wired: null, compressed: null })
    const swap = parsed('swap', parseSwap, null)
    const volumes = parsed('volumes', parseVolumes, [])
    const counters = parsed('traffic', parseNetwork, {})
    const allProcesses = parsed('processes', parseProcesses, [])
    const cpu = os.cpus().map((core) => ({ idle: core.times.idle, total: Object.values(core.times).reduce((a, b) => a + b, 0) }))
    const coreUsage = cpu.map((core, i) => cpuUsage(this.previousCpu[i], core))
    const sum = (values: typeof cpu) =>
      values.reduce((result, core) => ({ idle: result.idle + core.idle, total: result.total + core.total }), { idle: 0, total: 0 })
    const percent = cpuUsage(this.previousCpu.length ? sum(this.previousCpu) : undefined, sum(cpu))
    this.previousCpu = cpu
    const at = Date.now()
    const seconds = this.previousNet ? (at - this.previousNet.at) / 1000 : 0
    const network = Object.entries(os.networkInterfaces()).map(([name, addresses]) => {
      const counter = counters[name]
      const old = this.previousNet?.values[name]
      const rate = (key: 'received' | 'sent') =>
        counter && old && seconds > 0 && seconds < 30 && counter[key] >= old[key] ? (counter[key] - old[key]) / seconds : null
      return {
        name,
        addresses: (addresses || []).map((item) => item.address),
        internal: addresses?.every((item) => item.internal) ?? false,
        received: counter?.received ?? null,
        sent: counter?.sent ?? null,
        receiveRate: rate('received'),
        sendRate: rate('sent'),
        errors: counter?.errors ?? null,
      }
    })
    this.previousNet = { at, values: counters }
    const batteryText = byId.power.text || ''
    const thermal = byId.thermal.text
    const thermalWarning = thermal ? parseThermal(thermal) : null
    const pressureText = byId.pressure.text?.trim()
    if (!['1', '2', '4'].includes(pressureText || '')) byId.pressure.error ||= '系统未返回可识别的内存压力级别'
    if (!/Now drawing from/.test(batteryText)) byId.power.error ||= '系统未返回可识别的供电来源'
    if (!allProcesses.length) byId.processes.error ||= '系统未返回可识别的进程'
    if (!Object.keys(counters).length) byId.traffic.error ||= '系统未返回可识别的接口计数'
    const pressure = pressureText === '1' ? 'normal' : pressureText === '2' ? 'warning' : pressureText === '4' ? 'critical' : 'unknown'
    return {
      at,
      elapsed: at - started,
      host: {
        name: os.hostname(),
        model: this.model,
        chip: this.chip,
        arch: os.arch(),
        os: this.slow.find((p) => p.id === 'identity')?.text?.match(/System Version:\s*(.+)/)?.[1] || 'macOS（版本不可确认）',
        kernel: os.release(),
        uptime: os.uptime(),
        boot: at - os.uptime() * 1000,
        cores: cpu.length,
      },
      cpu: { percent, cores: coreUsage, load: os.loadavg() },
      memory: { total: os.totalmem(), free: os.freemem(), ...vm, swap, pressure },
      volumes,
      network,
      processes: [
        ...new Map(
          [...allProcesses.toSorted((a, b) => b.cpu - a.cpu).slice(0, 100), ...allProcesses.toSorted((a, b) => b.memory - a.memory).slice(0, 100)].map((p) => [
            p.pid,
            p,
          ]),
        ).values(),
      ],
      processCount: allProcesses.length,
      power: {
        source: /Now drawing from '([^']+)'/.exec(batteryText)?.[1] || '未知',
        battery: /\b(\d+)%/.test(batteryText) ? Number(/\b(\d+)%/.exec(batteryText)![1]) : null,
        charging: batteryText.split('\n').slice(1).join(' ').trim(),
        thermalWarning,
      },
      probes: [...fast, ...this.slow],
      services: this.services,
      runtime: {
        version: this.version,
        node: process.version,
        pid: process.pid,
        uptime: process.uptime(),
        memory: process.memoryUsage().rss,
        heap: process.memoryUsage().heapUsed,
        root: layout.rootDir,
        test: isTestInstance,
        deploymentFailure: this.deploymentFailure,
      },
    }
  }

  private async collectSlow() {
    const serviceWork = Promise.all(
      ['server', 'tunnel', 'deploy'].map(async (id): Promise<Service> => {
        try {
          return parseService(id, await command('/bin/launchctl', ['print', `gui/${os.userInfo().uid}/app.binos.${id}`]), id === 'deploy')
        } catch (error) {
          return { id, label: `app.binos.${id}`, periodic: id === 'deploy', state: 'unknown', error: errorText(error) }
        }
      }),
    )
    const work = slowCommands.map(([id, label, file, args]) =>
      probe(id, label, async () => {
        const text = await command(file, args)
        if (id === 'backup' && !text.startsWith('/')) throw new Error(text || '没有可读取的最近备份')
        return text
      }),
    )
    work.push(probe('crashes', '最近诊断与崩溃报告', reports))
    work.push(
      probe('internet', '互联网 HTTPS 探测（Apple）', async () => {
        const start = performance.now()
        const response = await fetch('https://www.apple.com/library/test/success.html', { signal: AbortSignal.timeout(4000), redirect: 'error' })
        const text = await response.text()
        if (!response.ok || !text.includes('Success')) throw new Error(`探测异常：HTTP ${response.status}`)
        return `HTTPS 可达 · ${Math.round(performance.now() - start)} ms`
      }),
    )
    const [results, services, model, chip, version, failure] = await Promise.all([
      Promise.all(work),
      serviceWork,
      command('/usr/sbin/sysctl', ['-n', 'hw.model']).catch(() => this.model),
      command('/usr/sbin/sysctl', ['-n', 'machdep.cpu.brand_string']).catch(() => this.chip),
      readFile(path.join(codeDir, 'VERSION'), 'utf8').catch(() => 'dev'),
      readFile(path.join(layout.deployDir, 'failed'), 'utf8').catch(() => undefined),
    ])
    this.slow = results
    this.services = services
    this.model = model
    this.chip = chip
    this.version = version.trim()
    this.deploymentFailure = failure?.trim()
    this.slowAt = Date.now()
  }
}

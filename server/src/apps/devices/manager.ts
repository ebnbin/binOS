import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { processStartTime, isRunning } from '../../process.js'
import type { ProcessIdentity } from '../../process.js'
import { build, dataDir, mode, statePath } from './config.js'
import { deviceEnv, discover, health, message, provision, reset, screenshot } from './platform.js'
import { event, release, requestLease, requireLease, schedule } from './state.js'
import { emptyState } from './types.js'
import type { Device, LeaseResult, Request, Snapshot, State } from './types.js'

export class Manager {
  state: State
  readonly startedAt = Date.now()
  private saved = ''
  private jobs = new Map<string, Promise<void>>()
  private busy = new Set<string>()
  private captures = new Map<string, { time: number; result: ReturnType<typeof screenshot> }>()
  private observed: Snapshot['observed'] = []
  private discoveryErrors: string[] = []
  private lastHealth = 0
  private checking = false
  private provisioning = false
  private runDir = path.join(dataDir, 'runs')

  constructor() {
    mkdirSync(this.runDir, { recursive: true })
    if (existsSync(statePath)) {
      const saved = JSON.parse(readFileSync(statePath, 'utf8')) as State & { mode: string }
      if (saved.version !== 1 || saved.mode !== mode || !Array.isArray(saved.devices) || !Array.isArray(saved.leases) || !Array.isArray(saved.queue) || !Array.isArray(saved.events)) throw new Error('设备登记簿格式或运行模式不匹配，已停止，未覆盖数据')
      this.state = saved
    } else this.state = emptyState()
    for (const file of readdirSync(this.runDir)) {
      const record = path.join(this.runDir, file)
      const identity = JSON.parse(readFileSync(record, 'utf8')) as ProcessIdentity
      if (isRunning(identity)) {
        try { process.kill(-identity.pid, 'SIGKILL') } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error }
      }
      rmSync(record)
    }
    if (mode === 'mock' && this.state.devices.length === 0) {
      this.state.devices = ['android', 'ios'].map((platform) => ({ id: `${platform}-preview`, platform: platform as Device['platform'], name: `${platform === 'ios' ? 'iPhone' : 'Android'} 预览设备`, target: `${platform}-preview`, status: 'free' }))
    }
    event(this.state, '设备管理服务启动', Date.now())
    this.save()
  }
  snapshot(): Snapshot {
    return { ...this.state, build, mode, pid: process.pid, startedAt: this.startedAt, observed: this.observed, discoveryErrors: this.discoveryErrors }
  }
  private save() {
    const content = JSON.stringify({ ...this.state, mode }) + '\n'
    if (content === this.saved) return
    writeFileSync(`${statePath}.tmp`, content, { mode: 0o600 })
    renameSync(`${statePath}.tmp`, statePath)
    this.saved = content
  }
  private device(id: string) {
    const device = this.state.devices.find((item) => item.id === id)
    if (!device) throw new Error('受管理设备不存在')
    return device
  }
  private requireIdle(id: string) {
    if (this.state.leases.some((lease) => lease.devices.includes(id)) || this.jobs.has(id)) throw new Error('设备正在使用或清理，请先等待并释放租约')
  }
  private result(owner: string): LeaseResult {
    const lease = this.state.leases.find((item) => item.owner === owner)
    if (lease) {
      if (!lease.claimed) lease.devices.forEach((id) => this.captures.delete(id))
      lease.claimed = true
      for (const id of lease.devices) this.device(id).status = 'leased'
      this.save()
    }
    return lease ? { lease, env: deviceEnv(lease.devices.map((id) => this.device(id))) } : { position: this.state.queue.findIndex((item) => item.owner === owner) + 1 }
  }
  tick() {
    schedule(this.state, Date.now(), this.busy)
    this.save()
    for (const device of this.state.devices.filter((item) => item.status === 'cleaning')) {
      if (this.jobs.has(device.id)) continue
      const work = this.clean(device).finally(() => this.jobs.delete(device.id))
      this.jobs.set(device.id, work)
    }
    if (!this.checking && Date.now() - this.lastHealth > 30_000) {
      this.checking = true
      this.lastHealth = Date.now()
      void this.check().finally(() => { this.checking = false })
    }
  }
  private async clean(device: Device) {
    try {
      if (mode === 'mock') await reset(device)
      else await this.resetWorker(device)
      device.status = 'free'
      delete device.error
      event(this.state, '清理完成，设备可用', Date.now(), device.id)
    } catch (error) {
      device.status = 'broken'
      device.error = message(error)
      event(this.state, `清理失败：${device.error}`, Date.now(), device.id)
    }
    device.checkedAt = Date.now()
    this.captures.delete(device.id)
    this.save()
  }
  private resetWorker(device: Device) {
    const record = path.join(this.runDir, `clean-${device.id}.json`)
    return new Promise<void>((resolve, reject) => {
      const entry = path.join(import.meta.dirname, `worker${path.extname(import.meta.filename)}`)
      const child = spawn(process.execPath, [...process.execArgv, entry, JSON.stringify(device)], { env: process.env, detached: true, stdio: ['ignore', 'ignore', 'pipe'] })
      let errors = ''
      const kill = () => { if (child.pid) { try { process.kill(-child.pid, 'SIGKILL') } catch { /* 已退出。 */ } } }
      const timer = setTimeout(kill, 10 * 60_000)
      child.stderr.on('data', (chunk: Buffer) => { errors = (errors + chunk.toString()).slice(-1200) })
      child.on('error', (error) => { clearTimeout(timer); rmSync(record, { force: true }); reject(error) })
      child.on('close', (code) => {
        clearTimeout(timer)
        rmSync(record, { force: true })
        if (code === 0) resolve()
        else reject(new Error(errors.trim() || '设备清理进程退出或超时'))
      })
      if (child.pid) {
        const startedAt = processStartTime(child.pid)
        if (startedAt) {
          try { writeFileSync(record, JSON.stringify({ pid: child.pid, startedAt })) } catch (error) { kill(); reject(error) }
        } else kill()
      }
    })
  }
  private async check() {
    for (const device of this.state.devices.filter((item) => item.status === 'free' || item.status === 'reserved' || item.status === 'leased')) {
      const status = device.status
      try {
        await health(device)
        if (device.status === status) delete device.error
      } catch (error) {
        if (device.status !== status) continue
        const problem = message(error)
        if (device.error !== problem) event(this.state, `健康检查失败：${problem}`, Date.now(), device.id)
        device.error = problem
        if (status === 'free') device.status = 'broken'
      }
      device.checkedAt = Date.now()
    }
    this.save()
  }
  async handle(request: Request): Promise<unknown> {
    const now = Date.now()
    switch (request.action) {
      case 'status': return this.snapshot()
      case 'discover': {
        const result = await discover()
        this.observed = result.observed.filter((item) => !this.state.devices.some((device) => device.target === item.target))
        this.discoveryErrors = result.discoveryErrors
        return this.snapshot()
      }
      case 'acquire':
        requestLease(this.state, request.owner, request.reason, request.platforms, now)
        this.tick()
        return this.result(request.owner)
      case 'renew': {
        const lease = requireLease(this.state, request.owner, request.lease)
        lease.lastSeen = now
        this.save()
        return this.result(request.owner)
      }
      case 'release': {
        const lease = requireLease(this.state, request.owner, request.lease)
        if (this.busy.has(lease.id)) throw new Error('受管理命令仍在执行，暂不能释放设备')
        release(this.state, lease, now, '主动释放，正在清理设备')
        this.tick()
        return { ok: true }
      }
      case 'cancel':
        this.state.queue = this.state.queue.filter((item) => item.owner !== request.owner)
        event(this.state, '取消排队', now, undefined, request.owner)
        this.save()
        return { ok: true }
      case 'control': {
        const device = this.device(request.device)
        this.requireIdle(device.id)
        device.status = request.operation === 'maintenance' ? 'maintenance' : 'cleaning'
        delete device.error
        event(this.state, request.operation === 'maintenance' ? '进入维护状态' : '恢复并清理设备', now, device.id)
        this.tick()
        return { ok: true }
      }
      case 'screenshot': {
        const device = this.device(request.device)
        if (request.owner || request.lease) {
          const lease = requireLease(this.state, request.owner!, request.lease!)
          if (!lease.devices.includes(device.id)) throw new Error('设备不属于当前租约')
        }
        if (device.status === 'cleaning') throw new Error('设备正在清理，稍后再截图')
        const previous = this.captures.get(device.id)
        if (previous && now - previous.time < 5000) return previous.result
        const result = screenshot(device)
        const entry = { time: now, result }
        this.captures.set(device.id, entry)
        result.then(() => { entry.time = Date.now() }, () => { if (this.captures.get(device.id) === entry) this.captures.delete(device.id) })
        return result
      }
      case 'provision': {
        if (this.provisioning) throw new Error('正在初始化设备，请稍后再试')
        this.provisioning = true
        try {
          const id = `${request.platform}-${randomUUID().slice(0, 8)}`
          let port = 5560
          while (this.state.devices.some((device) => device.target === `emulator-${port}`)) port += 2
          if (port > 5680) throw new Error('受管理设备数量超过限制')
          const device = await provision(request.platform, id, request.source, request.runtime, port)
          this.state.devices.push(device)
          event(this.state, '创建独立受管理设备，正在初始化', now, id)
          this.tick()
          return device
        } finally { this.provisioning = false }
      }
      case 'run': return this.run(request)
      case 'stop':
        if (this.busy.size || this.jobs.size || this.provisioning) throw new Error('正在执行命令或设备操作，暂不能停止服务')
        return { ok: true }
    }
  }
  private async run(request: Extract<Request, { action: 'run' }>) {
    const lease = requireLease(this.state, request.owner, request.lease)
    if (this.busy.has(lease.id)) throw new Error('该租约已有命令在执行')
    const devices = lease.devices.map((id) => this.device(id))
    if (devices.some((device) => device.error || device.status !== 'leased')) throw new Error('设备健康检查未通过')
    this.busy.add(lease.id)
    lease.lastSeen = Date.now()
    const record = path.join(this.runDir, `${lease.id}.json`)
    try {
      this.save()
      for (const device of devices) await health(device)
      return await new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
        const child = spawn(request.command[0], request.command.slice(1), {
          cwd: request.cwd, env: { ...process.env, ...deviceEnv(devices), BINOS_THREAD_ID: request.owner }, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
        })
        let stdout = '', stderr = '', reason = ''
        const kill = () => { if (child.pid) { try { process.kill(-child.pid, 'SIGKILL') } catch { /* 已退出。 */ } } }
        const timer = setTimeout(() => { reason = '设备命令执行超时'; kill() }, request.timeout)
        child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); if (stdout.length > 1024 * 1024) { reason = '输出超过 1 MiB，请将完整日志写入文件'; kill() } })
        child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); if (stderr.length > 1024 * 1024) { reason = '错误输出超过 1 MiB，请将日志写入文件'; kill() } })
        child.on('error', (error) => { clearTimeout(timer); reject(error) })
        child.on('close', (code) => { clearTimeout(timer); if (reason) reject(new Error(reason)); else resolve({ code: code ?? 1, stdout, stderr }) })
        if (child.pid) {
          const startedAt = processStartTime(child.pid)
          if (startedAt) {
            try { writeFileSync(record, JSON.stringify({ pid: child.pid, startedAt })) } catch (error) { kill(); reject(error) }
          } else kill()
        }
      })
    } finally {
      rmSync(record, { force: true })
      this.busy.delete(lease.id)
      lease.lastSeen = Date.now()
      this.save()
    }
  }
}

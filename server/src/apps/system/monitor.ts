import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { appDir } from '../../paths.js'
import { AlertTracker, conditions, defaultThresholds, parseThresholds } from './alerts.js'
import { Collector } from './collect.js'
import type { MonitorStatus, Sample, Snapshot, Thresholds } from './types.js'

const dir = appDir('system')
const stateFile = path.join(dir, 'monitor.json')

export class Monitor {
  private collector = new Collector()
  private tracker = new AlertTracker()
  private thresholds: Thresholds = defaultThresholds
  private snapshot: Snapshot | null = null
  private samples: Sample[] = []
  private collecting: Promise<void> | undefined
  private timer: ReturnType<typeof setTimeout> | undefined
  private collectionError: string | undefined
  private storageError: string | undefined
  private lastSaved = 0
  private awake: ChildProcess | undefined
  private awakeUntil: number | null = null
  private previousAt = 0
  private previousBoot = 0

  constructor() {
    if (existsSync(stateFile)) {
      try {
        const saved = JSON.parse(readFileSync(stateFile, 'utf8'))
        const thresholds = parseThresholds(saved.thresholds)
        if (!Array.isArray(saved.samples) || !Array.isArray(saved.alerts)) throw new Error('记录格式无效')
        const validAlerts = saved.alerts.every((item: unknown) => {
          if (!item || typeof item !== 'object') return false
          const alert = item as Record<string, unknown>
          return (
            ['id', 'key', 'title', 'detail'].every((key) => typeof alert[key] === 'string') &&
            ['warning', 'critical'].includes(String(alert.severity)) &&
            ['started', 'updated'].every((key) => typeof alert[key] === 'number' && Number.isFinite(alert[key])) &&
            ['resolved', 'acknowledged'].every((key) => alert[key] === undefined || (typeof alert[key] === 'number' && Number.isFinite(alert[key])))
          )
        })
        if (!validAlerts) throw new Error('告警记录格式无效')
        this.thresholds = thresholds
        this.samples = saved.samples
          .filter(
            (s: Sample) =>
              s &&
              Number.isFinite(s.at) &&
              s.at > Date.now() - 86_400_000 &&
              Number.isFinite(s.memory) &&
              ['cpu', 'swap', 'available', 'receive', 'send'].every((key) => s[key as keyof Sample] === null || Number.isFinite(s[key as keyof Sample])),
          )
          .slice(-1440)
        this.tracker = new AlertTracker(saved.alerts)
        this.previousAt = Number.isFinite(saved.lastAt) ? saved.lastAt : 0
        this.previousBoot = Number.isFinite(saved.boot) ? saved.boot : 0
      } catch (error) {
        this.storageError = `无法读取监控记录：${String(error)}`
        const now = Date.now()
        this.tracker = new AlertTracker([
          {
            id: `storage-${now}`,
            key: 'storage-recovery',
            title: '监控记录无法读取',
            detail: '已重新初始化监控记录；此前的历史可能不可用。',
            severity: 'warning',
            started: now,
            updated: now,
            resolved: now,
          },
        ])
      }
    }
  }
  start() {
    if (this.timer) return
    const tick = () => {
      void this.refresh().finally(() => {
        this.timer = setTimeout(tick, 5000)
        this.timer.unref()
      })
    }
    this.timer = setTimeout(tick, 0)
    this.timer.unref()
  }
  async refresh() {
    if (!this.collecting) {
      this.collecting = this.sample()
        .catch((error) => {
          this.collectionError = `采集失败：${String(error)}`
        })
        .finally(() => {
          this.collecting = undefined
        })
    }
    await this.collecting
  }
  status(): MonitorStatus {
    return {
      snapshot: this.snapshot,
      alerts: this.tracker.alerts,
      thresholds: this.thresholds,
      collecting: !!this.collecting,
      collectionError: this.collectionError,
      storageError: this.storageError,
      keepAwakeUntil: this.awakeUntil,
    }
  }
  history() {
    return this.samples
  }
  acknowledge(id: string) {
    this.tracker.acknowledge(id, Date.now())
    this.save()
  }
  configure(value: unknown) {
    this.thresholds = parseThresholds(value)
    this.save()
    return this.thresholds
  }
  async keepAwake(hours: number) {
    if (![0, 1, 8, 24].includes(hours)) throw new Error('保持唤醒时长无效')
    this.awake?.kill()
    this.awake = undefined
    this.awakeUntil = null
    if (hours > 0) {
      const child = spawn('/usr/bin/caffeinate', ['-i', '-t', String(hours * 3600), '-w', String(process.pid)], { stdio: 'ignore' })
      await new Promise<void>((resolve, reject) => {
        child.once('spawn', resolve)
        child.once('error', reject)
      })
      this.awake = child
      this.awakeUntil = Date.now() + hours * 3600_000
      const clear = () => {
        if (this.awake === child) {
          this.awake = undefined
          this.awakeUntil = null
        }
      }
      child.on('error', clear)
      child.on('exit', clear)
      child.unref()
    }
  }
  private async sample() {
    const snapshot = await this.collector.collect()
    const now = snapshot.at
    const conditionsNow = conditions(snapshot, this.thresholds)
    for (const active of this.tracker.alerts.filter((a) => !a.resolved)) {
      const unknown =
        (active.key === 'cpu' && snapshot.cpu.percent === null) ||
        (active.key === 'memory' && snapshot.memory.pressure === 'unknown') ||
        (active.key.startsWith('disk:') && snapshot.probes.some((p) => p.id === 'volumes' && p.error)) ||
        (active.key === 'thermal' && snapshot.power.thermalWarning === null) ||
        (active.key === 'battery' && snapshot.power.source === '未知')
      if (unknown)
        conditionsNow.push({ key: active.key, title: active.title, detail: '上次异常尚未确认恢复；本次采集不可用。', severity: active.severity, delay: 0 })
    }
    if (this.previousAt && now - this.previousAt > 120_000) {
      this.tracker.resetPending()
      this.tracker.alerts.unshift({
        id: `gap-${now}`,
        key: 'gap',
        title: '监控曾中断',
        detail: `上次采样 ${new Date(this.previousAt).toISOString()}；间隔 ${Math.round((now - this.previousAt) / 60_000)} 分钟。可能是休眠、重启或后端停止。`,
        severity: 'warning',
        started: this.previousAt,
        updated: now,
        resolved: now,
      })
    }
    if (this.previousBoot && Math.abs(snapshot.host.boot - this.previousBoot) > 60_000) {
      this.tracker.alerts.unshift({
        id: `boot-${now}`,
        key: 'boot',
        title: '宿主发生重启',
        detail: `本次启动时间 ${new Date(snapshot.host.boot).toISOString()}`,
        severity: 'warning',
        started: now,
        updated: now,
        resolved: now,
      })
    }
    this.previousAt = now
    this.previousBoot = snapshot.host.boot
    this.tracker.update(conditionsNow, now)
    this.snapshot = snapshot
    this.collectionError = undefined
    if (!this.samples.length || now - this.samples.at(-1)!.at >= 60_000) {
      const rates = snapshot.network.filter((n) => !n.internal)
      const totalRate = (key: 'receiveRate' | 'sendRate') => (rates.some((n) => n[key] !== null) ? rates.reduce((sum, n) => sum + (n[key] || 0), 0) : null)
      const disk = snapshot.volumes.find((v) => v.mount === '/System/Volumes/Data') || snapshot.volumes.find((v) => v.mount === '/')
      this.samples.push({
        at: now,
        cpu: snapshot.cpu.percent,
        memory: 100 * (1 - snapshot.memory.free / snapshot.memory.total),
        swap: snapshot.memory.swap,
        available: disk?.available ?? null,
        receive: totalRate('receiveRate'),
        send: totalRate('sendRate'),
      })
      this.samples = this.samples.filter((s) => now - s.at < 86_400_000).slice(-1440)
    }
    if (now - this.lastSaved >= 60_000) this.save()
  }
  private save() {
    try {
      mkdirSync(dir, { recursive: true })
      writeFileSync(
        stateFile + '.tmp',
        JSON.stringify({ thresholds: this.thresholds, alerts: this.tracker.alerts, samples: this.samples, lastAt: this.previousAt, boot: this.previousBoot }),
      )
      renameSync(stateFile + '.tmp', stateFile)
      this.storageError = undefined
      this.lastSaved = Date.now()
    } catch (error) {
      this.storageError = `监控记录保存失败：${String(error)}`
    }
  }
}
export const monitor = new Monitor()

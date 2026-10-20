import { randomUUID } from 'node:crypto'
import type { Alert, Snapshot, Thresholds } from './types.js'

export const defaultThresholds: Thresholds = { cpu: 90, cpuSeconds: 60, diskFreeGB: 20, diskFreePercent: 10, battery: 20 }
export type Condition = { key: string; title: string; detail: string; severity: Alert['severity']; delay: number }
export function conditions(snapshot: Snapshot, settings: Thresholds): Condition[] {
  const items: Condition[] = []
  const add = (key: string, title: string, detail: string, severity: Alert['severity'] = 'warning', delay = 15_000) =>
    items.push({ key, title, detail, severity, delay })
  if (snapshot.cpu.percent !== null && snapshot.cpu.percent >= settings.cpu)
    add('cpu', 'CPU 持续高负载', `总使用率 ${snapshot.cpu.percent.toFixed(1)}%，阈值 ${settings.cpu}%`, 'warning', settings.cpuSeconds * 1000)
  if (['warning', 'critical'].includes(snapshot.memory.pressure))
    add(
      'memory',
      '内存压力升高',
      snapshot.memory.pressure === 'critical' ? '系统报告严重内存压力，请检查占用进程' : '系统报告警告级内存压力',
      snapshot.memory.pressure === 'critical' ? 'critical' : 'warning',
    )
  const seen = new Set<string>()
  for (const volume of snapshot.volumes.filter((v) => v.mount === '/' || v.mount === '/System/Volumes/Data' || v.mount.startsWith('/Volumes/'))) {
    const id = `${volume.total}:${volume.available}`
    if (seen.has(id) || volume.total <= 0) continue
    seen.add(id)
    const percent = (volume.available / volume.total) * 100
    if (volume.available < settings.diskFreeGB * 1024 ** 3 || percent < settings.diskFreePercent)
      add(
        `disk:${volume.mount}`,
        '磁盘空间不足',
        `${volume.mount} 可用 ${(volume.available / 1024 ** 3).toFixed(1)} GiB（${percent.toFixed(1)}%）`,
        percent < 3 ? 'critical' : 'warning',
      )
  }
  if (snapshot.power.source === 'Battery Power' && snapshot.power.battery !== null && snapshot.power.battery <= settings.battery)
    add('battery', '电池电量偏低', `正在使用电池，剩余 ${snapshot.power.battery}%`, snapshot.power.battery <= 10 ? 'critical' : 'warning')
  if (snapshot.power.thermalWarning) add('thermal', '系统报告热限制', 'macOS 报告热警告或 CPU 性能限制，查看热状态详情', 'critical')
  for (const service of snapshot.services) {
    // 预览观察到的是正式版的 launchd 服务；预览自身不以这些服务运行。
    if (snapshot.runtime.test) continue
    if (!service.periodic && service.state !== 'running')
      add(`service:${service.id}`, `${service.label} 不在运行`, service.error || `状态：${service.state}`, 'critical', 10_000)
    if (service.periodic && service.exitCode !== undefined && service.exitCode !== 0) add('deploy-exit', '上线服务上次执行失败', `退出码 ${service.exitCode}`)
  }
  if (snapshot.runtime.deploymentFailure) add('deploy-failure', '有被阻止再次上线的提交', snapshot.runtime.deploymentFailure, 'warning', 0)
  for (const probe of snapshot.probes) {
    if (probe.error && ['vm', 'swap', 'pressure', 'volumes', 'traffic', 'processes', 'power', 'thermal', 'internet'].includes(probe.id))
      add(`probe:${probe.id}`, `${probe.label}不可确认`, probe.error, probe.id === 'internet' ? 'critical' : 'warning', 30_000)
    if (probe.id === 'smart' && probe.text && /SMART Status:\s*(?!Verified|Not Supported|Not Applicable)(\S+)/i.test(probe.text))
      add('smart', '启动磁盘 SMART 异常', '请查看启动磁盘详情并检查备份', 'critical', 0)
    if (probe.id === 'backup' && probe.error) add('backup', '无法确认最近备份', 'Time Machine 未返回最近备份；可能未配置、目标不可达或权限不足', 'warning', 0)
    if (probe.id === 'backup' && probe.text) {
      const stamp = /(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})(\d{2})/.exec(probe.text)
      if (stamp) {
        const backupAt = new Date(+stamp[1], +stamp[2] - 1, +stamp[3], +stamp[4], +stamp[5], +stamp[6]).getTime()
        if (snapshot.at - backupAt > 3 * 86400_000) add('backup-old', '最近备份超过 3 天', probe.text, 'warning', 0)
      }
    }
    if (probe.id === 'crashes' && probe.text) {
      const recentPanic = probe.text.split('\n').find((line) => /panic/i.test(line) && snapshot.at - Date.parse(line.slice(0, 24)) < 86400_000)
      if (recentPanic) add('panic', '最近 24 小时出现 panic 报告', recentPanic, 'critical', 0)
    }
    if (probe.id === 'filevault' && /FileVault is Off/.test(probe.text || ''))
      add('filevault', 'FileVault 未开启', '磁盘未启用 FileVault，远程离开前请确认物理访问风险', 'warning', 0)
    if (probe.id === 'sip' && /status:\s*disabled/i.test(probe.text || '')) add('sip', '系统完整性保护已关闭', '请查看宿主安全状态', 'warning', 0)
    if (probe.id === 'gatekeeper' && /assessments disabled/i.test(probe.text || '')) add('gatekeeper', 'Gatekeeper 已关闭', '请查看宿主安全状态', 'warning', 0)
    if (probe.id === 'sleep' && /(?:^|\n)\s*sleep\s+[1-9]\d*/.test(probe.text || ''))
      add('sleep', '配置允许自动休眠', '自动休眠可能使远程服务不可用；不同电源模式分别生效', 'warning', 0)
  }
  return items
}

export class AlertTracker {
  private pending = new Map<string, number>()
  alerts: Alert[]
  constructor(alerts: Alert[] = []) {
    this.alerts = alerts
  }
  resetPending() {
    this.pending.clear()
  }
  update(items: Condition[], now: number) {
    const current = new Map(items.map((item) => [item.key, item]))
    for (const key of this.pending.keys()) if (!current.has(key)) this.pending.delete(key)
    for (const [key, condition] of current) {
      const active = this.alerts.find((item) => item.key === key && !item.resolved)
      if (active) {
        if (active.severity !== condition.severity) active.acknowledged = undefined
        Object.assign(active, { title: condition.title, detail: condition.detail, severity: condition.severity, updated: now })
      } else {
        const since = this.pending.get(key) ?? now
        this.pending.set(key, since)
        if (now - since >= condition.delay) {
          this.alerts.unshift({
            id: randomUUID(),
            key,
            title: condition.title,
            detail: condition.detail,
            severity: condition.severity,
            started: since,
            updated: now,
          })
          this.pending.delete(key)
        }
      }
    }
    for (const alert of this.alerts)
      if (!alert.resolved && !current.has(alert.key)) {
        alert.resolved = now
        alert.updated = now
      }
    this.alerts = [...this.alerts.filter((a) => !a.resolved), ...this.alerts.filter((a) => a.resolved).slice(0, 300)]
  }
  acknowledge(id: string, now: number) {
    const alert = this.alerts.find((item) => item.id === id)
    if (!alert) throw new Error('告警不存在')
    alert.acknowledged = now
  }
}

export function parseThresholds(value: unknown): Thresholds {
  if (!value || typeof value !== 'object') throw new Error('告警设置无效')
  const input = value as Record<string, unknown>
  const ranges = { cpu: [10, 100], cpuSeconds: [15, 3600], diskFreeGB: [1, 1000], diskFreePercent: [1, 50], battery: [5, 90] }
  for (const [key, [min, max]] of Object.entries(ranges)) {
    const n = input[key]
    if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max) throw new Error(`${key} 必须在 ${min}–${max} 之间`)
  }
  return Object.fromEntries(Object.keys(ranges).map((key) => [key, input[key]])) as Thresholds
}

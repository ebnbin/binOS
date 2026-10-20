import type { HostProcess, Volume } from './types.js'

export function parseVm(text: string) {
  const page = Number(/page size of (\d+)/.exec(text)?.[1])
  if (!page) throw new Error('无法识别 vm_stat 页大小')
  const pages = (name: string) => {
    const match = new RegExp(`${name}:\\s+(\\d+)`).exec(text)
    return match ? Number(match[1]) * page : null
  }
  return { cached: pages('File-backed pages'), wired: pages('Pages wired down'), compressed: pages('Pages occupied by compressor') }
}
export function parseSwap(text: string) {
  const match = /used\s*=\s*([\d.]+)([KMGTP])/.exec(text)
  if (!match) throw new Error('无法识别交换空间')
  return Number(match[1]) * 1024 ** ('KMGTP'.indexOf(match[2]) + 1)
}
export function parseVolumes(text: string): Volume[] {
  const volumes = text
    .split('\n')
    .slice(1)
    .flatMap((line) => {
      const match = /^(\S+)\s+(\d+)\s+(\d+)\s+(\d+)\s+\d+%\s+(.+)$/.exec(line.trim())
      return match
        ? [{ filesystem: match[1], total: Number(match[2]) * 1024, used: Number(match[3]) * 1024, available: Number(match[4]) * 1024, mount: match[5] }]
        : []
    })
  if (!volumes.length) throw new Error('没有可读取的磁盘容量')
  return volumes
}
export function parseProcesses(text: string): HostProcess[] {
  return text.split('\n').flatMap((line) => {
    const m = /^\s*(\d+)\s+(\d+)\s+([\d.]+)\s+(\d+)\s+(\S+)\s+(.+)$/.exec(line)
    return m ? [{ pid: +m[1], parent: +m[2], cpu: +m[3], memory: +m[4] * 1024, elapsed: m[5], name: m[6] }] : []
  })
}
export function parseNetwork(text: string): Record<string, { received: number; sent: number; errors: number }> {
  const result: ReturnType<typeof parseNetwork> = {}
  for (const line of text.split('\n').slice(1)) {
    const fields = line.trim().split(/\s+/)
    if (!fields[2]?.startsWith('<Link#')) continue
    // 链路行可能没有 MAC 地址；从末尾取计数，避免把同一接口的 IPv4 / IPv6 行重复累加。
    const tail = fields.slice(-7)
    if (tail.length !== 7 || tail.some((s) => !/^\d+$/.test(s))) continue
    result[fields[0].replace(/\*$/, '')] = { received: +tail[2], sent: +tail[5], errors: +tail[1] + +tail[4] }
  }
  return result
}
export function cpuUsage(previous: { idle: number; total: number } | undefined, next: { idle: number; total: number }) {
  if (!previous || next.total <= previous.total || next.idle < previous.idle) return null
  return Math.max(0, Math.min(100, 100 * (1 - (next.idle - previous.idle) / (next.total - previous.total))))
}
export function parseService(id: string, text: string, periodic: boolean) {
  return {
    id,
    label: `app.binos.${id}`,
    periodic,
    state: /^\s*state = (.+)$/m.exec(text)?.[1]?.trim() || 'unknown',
    pid: numberField(text, 'pid'),
    exitCode: numberField(text, 'last exit code'),
  }
}
function numberField(text: string, field: string) {
  const value = new RegExp(`^\\s*${field} = (-?\\d+)`, 'm').exec(text)?.[1]
  return value === undefined ? undefined : Number(value)
}

export function parseThermal(text: string): boolean | null {
  const limits = [...text.matchAll(/CPU_(?:Speed|Scheduler)_Limit\s*=\s*(\d+)/g)].map((m) => Number(m[1]))
  const level = /(?:Thermal_Level|ThermalWarningLevel)\s*=\s*(\d+)/i.exec(text)
  if (!limits.length && !level) return null
  return limits.some((n) => n < 100) || !!(level && Number(level[1]) > 0)
}

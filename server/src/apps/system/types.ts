export type Probe = { id: string; label: string; at: number; text?: string; error?: string }
export type Volume = { filesystem: string; mount: string; total: number; available: number; used: number }
export type Network = {
  name: string
  addresses: string[]
  internal: boolean
  received: number | null
  sent: number | null
  receiveRate: number | null
  sendRate: number | null
  errors: number | null
}
export type HostProcess = { pid: number; parent: number; cpu: number; memory: number; elapsed: string; name: string }
export type Service = { id: string; label: string; state: string; pid?: number; exitCode?: number; error?: string; periodic: boolean }
export type Snapshot = {
  at: number
  elapsed: number
  host: { name: string; model: string; chip: string; arch: string; os: string; kernel: string; uptime: number; boot: number; cores: number }
  cpu: { percent: number | null; cores: (number | null)[]; load: number[] }
  memory: {
    total: number
    free: number
    cached: number | null
    wired: number | null
    compressed: number | null
    swap: number | null
    pressure: 'normal' | 'warning' | 'critical' | 'unknown'
  }
  volumes: Volume[]
  network: Network[]
  processes: HostProcess[]
  processCount: number
  power: { source: string; battery: number | null; charging: string; thermalWarning: boolean | null }
  probes: Probe[]
  services: Service[]
  runtime: { version: string; node: string; pid: number; uptime: number; memory: number; heap: number; root: string; test: boolean; deploymentFailure?: string }
}
export type Sample = {
  at: number
  cpu: number | null
  memory: number
  swap: number | null
  available: number | null
  receive: number | null
  send: number | null
}
export type Alert = {
  id: string
  key: string
  title: string
  detail: string
  severity: 'warning' | 'critical'
  started: number
  updated: number
  resolved?: number
  acknowledged?: number
}
export type Thresholds = { cpu: number; cpuSeconds: number; diskFreeGB: number; diskFreePercent: number; battery: number }
export type MonitorStatus = {
  snapshot: Snapshot | null
  alerts: Alert[]
  thresholds: Thresholds
  collecting: boolean
  collectionError?: string
  storageError?: string
  keepAwakeUntil: number | null
}

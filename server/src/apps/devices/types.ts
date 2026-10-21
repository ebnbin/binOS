export type Platform = 'android' | 'ios'
export type DeviceStatus = 'free' | 'reserved' | 'leased' | 'cleaning' | 'broken' | 'maintenance'
export type Device = {
  id: string
  platform: Platform
  name: string
  target: string
  system?: string
  status: DeviceStatus
  error?: string
  checkedAt?: number
}
export type Lease = { claimed?: true; id: string; owner: string; reason: string; platforms: Platform[]; devices: string[]; createdAt: number; lastSeen: number }
export type Waiting = { owner: string; reason: string; platforms: Platform[]; createdAt: number; lastSeen: number }
export type DeviceEvent = { time: number; text: string; device?: string; owner?: string }
export type State = { version: 1; devices: Device[]; leases: Lease[]; queue: Waiting[]; events: DeviceEvent[] }
export type ObservedDevice = { platform: Platform; name: string; target: string; state: string }
export type Snapshot = State & { build: string; mode: 'mock' | 'real'; pid: number; startedAt: number; observed: ObservedDevice[]; discoveryErrors: string[] }
export type LeaseResult = { lease?: Lease; position?: number; env?: Record<string, string> }
export type Request =
  | { action: 'status' | 'discover' | 'stop' }
  | { action: 'acquire'; owner: string; reason: string; platforms: Platform[] }
  | { action: 'renew' | 'release'; owner: string; lease: string }
  | { action: 'cancel'; owner: string }
  | { action: 'control'; device: string; operation: 'maintenance' | 'restore' }
  | { action: 'screenshot'; device: string; owner?: string; lease?: string }
  | { action: 'provision'; platform: Platform; source: string; runtime?: string }
  | { action: 'run'; owner: string; lease: string; command: string[]; cwd: string; timeout: number }
export const emptyState = (): State => ({ version: 1, devices: [], leases: [], queue: [], events: [] })

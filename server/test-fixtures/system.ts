import type { Snapshot } from '../src/apps/system/types.js'

export function snapshot(at = 1_800_000_000_000): Snapshot {
  return {
    at,
    elapsed: 100,
    host: { name: 'test-mac', model: 'Mac-test', chip: 'Test CPU', arch: 'arm64', os: 'macOS', kernel: '26', uptime: 600, boot: at - 600_000, cores: 8 },
    cpu: { percent: 10, cores: [10], load: [1, 1, 1] },
    memory: { total: 64 * 1024 ** 3, free: 1024 ** 3, cached: 30 * 1024 ** 3, wired: 4 * 1024 ** 3, compressed: 0, swap: 0, pressure: 'normal' },
    volumes: [{ filesystem: '/dev/disk1', mount: '/', total: 1024 ** 4, used: 100 * 1024 ** 3, available: 800 * 1024 ** 3 }],
    network: [],
    processes: [],
    processCount: 0,
    power: { source: 'AC Power', battery: null, charging: '', thermalWarning: false },
    probes: [],
    services: [{ id: 'deploy', label: 'app.binos.deploy', state: 'not running', exitCode: 0, periodic: true }],
    runtime: { version: 'test', node: 'v26', pid: 1, uptime: 100, memory: 10000, heap: 1000, root: '/test', test: false },
  }
}

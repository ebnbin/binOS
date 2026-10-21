import { chmodSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

// node-pty 1.1.0 的 macOS 预编译包没有给 spawn-helper 执行权限。
if (process.platform === 'darwin') {
  const require = createRequire(new URL('../server/package.json', import.meta.url))
  const dir = path.dirname(require.resolve('node-pty/package.json'))
  for (const location of [`prebuilds/darwin-${process.arch}`, 'build/Release']) {
    const helper = path.join(dir, location, 'spawn-helper')
    if (existsSync(helper)) chmodSync(helper, 0o755)
  }
}

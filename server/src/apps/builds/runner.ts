import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream, closeSync, openSync, writeFileSync } from 'node:fs'
import { lstat, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { currentProcess, processStartTime } from '../../process.js'
import type { Artifact, Target } from './types.js'

// 独立进程负责超时与进程组回收；构建服务更新不改变正在运行的脚本。
const [source, output, result, target, number, mode] = process.argv.slice(2)
await writeFile(path.join(path.dirname(result), 'runner.json'), JSON.stringify(currentProcess()))
let child: ReturnType<typeof spawn> | undefined
let cancelled = false
let timedOut = false
function kill() { if (child?.pid) { try { process.kill(-child.pid, 'SIGKILL') } catch { /* 进程已退出。 */ } } }
process.on('SIGTERM', () => { cancelled = true; kill() })
const timer = setTimeout(() => { timedOut = true; kill() }, 60 * 60_000)
let error: string | undefined
try {
  if (mode === 'mock') {
    await new Promise((resolve) => setTimeout(resolve, 1200))
    if (!cancelled) await writeFile(path.join(output, 'preview.txt'), `预览构建：${target}\n`)
  } else {
    const log = openSync(path.join(path.dirname(result), 'build.log'), 'a', 0o600)
    try {
      await new Promise<void>((resolve, reject) => {
        child = spawn('/bin/bash', ['scripts/mobile-build.sh', target], { cwd: source, detached: true, stdio: ['ignore', log, log], env: { ...process.env, BINOS_BUILD_OUTPUT: output, BINOS_BUILD_NUMBER: number } })
        if (child.pid) {
          const startedAt = processStartTime(child.pid)
          if (startedAt) writeFileSync(path.join(path.dirname(result), 'child.json'), JSON.stringify({ pid: child.pid, startedAt }))
        }
        child.on('error', reject)
        child.on('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`构建退出：${code ?? signal}`)))
      })
    } finally { closeSync(log); kill() }
  }
} catch (e) { error = e instanceof Error ? e.message : String(e) }
clearTimeout(timer)
if (cancelled) error = '已取消'
if (timedOut) error = '构建超过 60 分钟'
const artifacts: Artifact[] = []
if (!error) {
  for (const name of await readdir(output)) {
    const file = path.join(output, name)
    const info = await lstat(file)
    if (!info.isFile() || name.startsWith('.')) continue
    const hasher = createHash('sha256')
    for await (const chunk of createReadStream(file)) hasher.update(chunk)
    const hash = hasher.digest('hex')
    artifacts.push({ name, size: info.size, sha256: hash })
  }
  const expected: Record<Target, string> = { android: 'binos-android-debug.apk', 'ios-simulator': 'binos-ios-simulator.app.zip', 'ios-adhoc': 'binos-ios-adhoc.ipa' }
  if (!artifacts.some((a) => a.name === (mode === 'mock' ? 'preview.txt' : expected[target as Target]))) error = '构建没有生成预期产物'
}
await writeFile(result + '.tmp', JSON.stringify({ status: cancelled ? 'cancelled' : error ? 'failed' : 'success', error, artifacts: error ? [] : artifacts, endedAt: new Date().toISOString() }))
const { rename } = await import('node:fs/promises')
await rename(result + '.tmp', result)

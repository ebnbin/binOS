import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { rootFromEnv, rootLayout } from '../server/src/layout.ts'
import { serverPort } from '../server/src/production.ts'

const { logsDir } = rootLayout(rootFromEnv())
const repoDir = path.resolve(import.meta.dirname, '..')
const deployLog = path.join(logsDir, 'deploy.log')

const git = (...args: string[]) => execFileSync('git', args, { cwd: repoDir, encoding: 'utf8' }).trim()
const short = (commit: string) => commit.slice(0, 7)

// binos.app 前面有 Cloudflare 登录，命令行只能查本机的正式版
git('fetch', '--quiet', 'origin', 'main')
const target = git('rev-parse', process.argv[2] ?? 'origin/main')
console.log(`等待正式版包含 ${short(target)}`)

const deadline = Date.now() + 3 * 60_000
while (Date.now() < deadline) {
  const version = await runningVersion()
  if (version && contains(version, target)) {
    console.log(`✓ 正式版正在运行 ${short(version)}，包含 ${short(target)}`)
    process.exit(0)
  }
  if (deployLogTail().some((line) => line.includes(`✗ ${short(target)}`))) {
    console.log(`✗ ${short(target)} 上线失败，已自动切回原版本。deploy.log 最后几行：`)
    console.log(deployLogTail().slice(-10).join('\n'))
    console.log(`服务日志见 ${path.join(logsDir, 'server.log')}`)
    process.exit(1)
  }
  await sleep(2000)
}
const running = await runningVersion()
console.log(`✗ 3 分钟内没有上线 ${short(target)}，正式版${running ? `正在运行 ${short(running)}` : '没有响应'}。deploy.log 最后几行：`)
console.log(deployLogTail().slice(-10).join('\n'))
process.exit(1)

async function runningVersion() {
  try {
    const health = (await (await fetch(`http://127.0.0.1:${serverPort}/api/health`)).json()) as { version?: string }
    return health.version
  } catch {
    return undefined
  }
}

function contains(version: string, commit: string) {
  try {
    git('merge-base', '--is-ancestor', commit, version)
    return true
  } catch {
    return false
  }
}

function deployLogTail() {
  try {
    return readFileSync(deployLog, 'utf8').trimEnd().split('\n').slice(-200)
  } catch {
    return []
  }
}

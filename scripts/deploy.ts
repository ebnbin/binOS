import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readlinkSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { rootFromEnv, rootLayout } from '../server/src/layout.ts'
import { acquireProcessLock } from '../server/src/process.ts'
import { serverLabel, serverPort } from './server.ts'

const { buildsDir, logsDir } = rootLayout(rootFromEnv())
const repoDir = path.resolve(import.meta.dirname, '..')
const serverLog = path.join(logsDir, 'server.log')

const git = (...args: string[]) => execFileSync('git', args, { cwd: repoDir, encoding: 'utf8' }).trim()
const run = (command: string, args: string[], cwd: string) => execFileSync(command, args, { cwd, stdio: 'inherit' })
const short = (commit: string) => commit.slice(0, 7)
const say = (message: string) => console.log(`${new Date().toISOString()} ${message}`)

const command = process.argv[2]
if (command !== 'deploy' && command !== 'rollback') {
  throw new Error('用法：node scripts/deploy.ts deploy | rollback')
}
const holder = acquireProcessLock(path.join(buildsDir, '.deploy.lock'))
if (holder) {
  say(`已有上线或回退在进行（进程 ${holder.pid}），这次跳过`)
  process.exit(0)
}
if (command === 'deploy') {
  const commit = git('rev-parse', 'HEAD')
  // 定时任务每分钟执行一次，已经在运行时不输出，免得日志里每分钟多一行
  if (linkTarget('current') === commit) {
    if (process.stdout.isTTY) {
      say(`已经在运行 ${short(commit)}`)
    }
    process.exit(0)
  }
  if (git('status', '--porcelain')) {
    say('注意：工作区有未提交的改动，不包含在这次构建里')
  }
  if (existsSync(path.join(buildsDir, commit))) {
    say(`${short(commit)} 已经构建过，直接切换`)
  } else {
    say(`构建 ${short(commit)}`)
    build(commit)
  }
  await switchTo(commit)
} else {
  const previous = linkTarget('previous')
  if (!previous) {
    throw new Error('没有可以回退的版本')
  }
  await switchTo(previous)
}

// 在临时目录里构建完整的仓库，版本目录里只放运行需要的部分：server 和它的生产依赖、页面的构建产物
function build(commit: string) {
  const buildDir = path.join(buildsDir, commit)
  const staging = `${buildDir}.tmp`
  const source = path.join(staging, 'source')
  const output = path.join(staging, 'build')
  rmSync(staging, { recursive: true, force: true })
  mkdirSync(source, { recursive: true })
  try {
    // 只取这个提交里的代码，不混入工作区里未提交的改动
    const archive = path.join(staging, 'source.tar')
    git('archive', '--output', archive, commit)
    run('tar', ['-xf', archive, '-C', source], source)
    run('pnpm', ['install', '--frozen-lockfile'], source)
    run('pnpm', ['build'], source)
    run('pnpm', ['--filter', '@binos/server', '--prod', 'deploy', path.join(output, 'server')], source)
    cpSync(path.join(source, 'web', 'dist'), path.join(output, 'web', 'dist'), { recursive: true })
    writeFileSync(path.join(output, 'VERSION'), commit + '\n')
    renameSync(output, buildDir)
  } finally {
    rmSync(staging, { recursive: true, force: true })
  }
}

async function switchTo(commit: string) {
  const old = linkTarget('current')
  if (old === commit) {
    say(`已经在运行 ${short(commit)}`)
    return
  }
  if (await activate(commit)) {
    if (old) {
      link(old, 'previous')
    }
    say(`✓ 正在运行 ${short(commit)}`)
    return
  }
  say(`✗ ${short(commit)} 没有正常运行，日志见 ${serverLog}`)
  if (old) {
    say((await activate(old)) ? `已切回 ${short(old)}` : `切回 ${short(old)} 后仍不正常，需要人工处理`)
  }
  process.exitCode = 1
}

async function activate(commit: string) {
  link(commit, 'current')
  execFileSync('launchctl', ['kickstart', '-k', `gui/${os.userInfo().uid}/${serverLabel}`])
  return isHealthy(commit)
}

async function isHealthy(commit: string) {
  const base = `http://127.0.0.1:${serverPort}`
  for (let i = 0; i < 60; i++) {
    await sleep(500)
    try {
      const health = (await (await fetch(`${base}/api/health`)).json()) as { version?: string }
      const page = await fetch(`${base}/`)
      if (health.version === commit && page.ok && (await page.text()).includes('id="root"')) {
        return true
      }
    } catch {
      // 还没启动好
    }
  }
  return false
}

function linkTarget(name: string): string | undefined {
  try {
    return readlinkSync(path.join(buildsDir, name))
  } catch {
    return undefined
  }
}

// 先建临时链接再改名，切换是一步完成的；链接里只写 commit id，根目录搬家后仍然有效
function link(target: string, name: string) {
  const linkPath = path.join(buildsDir, name)
  rmSync(`${linkPath}.tmp`, { force: true })
  symlinkSync(target, `${linkPath}.tmp`)
  renameSync(`${linkPath}.tmp`, linkPath)
}

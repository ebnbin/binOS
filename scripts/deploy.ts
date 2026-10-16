// 上线与回退：
//   BINOS_ROOT=<根目录> npm run deploy    构建当前提交（HEAD），切换为正式运行的版本；已在运行就什么都不做
//   BINOS_ROOT=<根目录> npm run rollback  切回上一个版本
// 切换后重启正式版并检查，不正常就切回原来的版本。同一时间只有一个上线或回退在进行
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readlinkSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { processStartTime } from '../server/src/process.ts'
import { serverLabel, serverPort } from './server.ts'

const root = process.env.BINOS_ROOT
if (!root) {
  throw new Error('BINOS_ROOT is not set')
}
const repoDir = path.resolve(import.meta.dirname, '..')
const buildsDir = path.join(path.resolve(root), 'System', 'builds')
const serverLog = path.join(path.resolve(root), 'Library', 'logs', 'server.log')
const lockPath = path.join(buildsDir, '.deploy.lock')

const git = (...args: string[]) => execFileSync('git', args, { cwd: repoDir, encoding: 'utf8' }).trim()
const run = (command: string, args: string[], cwd: string) => execFileSync(command, args, { cwd, stdio: 'inherit' })
const short = (commit: string) => commit.slice(0, 7)
const say = (message: string) => console.log(`${new Date().toISOString()} ${message}`)

const command = process.argv[2]
if (command !== 'deploy' && command !== 'rollback') {
  throw new Error('用法：node scripts/deploy.ts deploy | rollback')
}
if (!acquireLock()) {
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

// 已有上线或回退在进行时返回 false；记录的进程已经不在时，锁已经无效，接管它
function acquireLock(): boolean {
  mkdirSync(buildsDir, { recursive: true })
  const own = { pid: process.pid, startedAt: processStartTime(process.pid) }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      writeFileSync(lockPath, JSON.stringify(own) + '\n', { flag: 'wx' })
      process.on('exit', () => {
        if (readLock()?.pid === own.pid) {
          rmSync(lockPath, { force: true })
        }
      })
      return true
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw err
      }
    }
    const holder = readLock()
    if (holder && processStartTime(holder.pid) === holder.startedAt) {
      say(`已有上线或回退在进行（进程 ${holder.pid}），这次跳过`)
      return false
    }
    rmSync(lockPath, { force: true })
  }
  throw new Error(`无法获取 ${lockPath}`)
}

function readLock(): { pid: number; startedAt: string } | undefined {
  try {
    return JSON.parse(readFileSync(lockPath, 'utf8'))
  } catch {
    return undefined
  }
}

function build(commit: string) {
  const buildDir = path.join(buildsDir, commit)
  const tmp = `${buildDir}.tmp`
  rmSync(tmp, { recursive: true, force: true })
  mkdirSync(tmp, { recursive: true })
  try {
    // 只取这个提交里的代码，工作区里未提交的改动不会混进来
    const archive = path.join(tmp, 'source.tar')
    git('archive', '--output', archive, commit)
    run('tar', ['-xf', archive, '-C', tmp], tmp)
    rmSync(archive)
    for (const dir of ['web', 'server']) {
      run('npm', ['ci'], path.join(tmp, dir))
      run('npm', ['run', 'build'], path.join(tmp, dir))
    }
    // 运行时只需要前端构建出的页面和后端的正式依赖
    rmSync(path.join(tmp, 'web', 'node_modules'), { recursive: true, force: true })
    run('npm', ['prune', '--omit=dev'], path.join(tmp, 'server'))
    writeFileSync(path.join(tmp, 'VERSION'), commit + '\n')
    renameSync(tmp, buildDir)
  } catch (err) {
    rmSync(tmp, { recursive: true, force: true })
    throw err
  }
}

// 切换到这个版本；成功后原来的版本记为 previous，失败就切回原来的版本
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

// 运行的版本对得上、首页能打开才算正常；最多等 30 秒
async function isHealthy(commit: string) {
  const base = `http://127.0.0.1:${serverPort}`
  for (let i = 0; i < 60; i++) {
    await sleep(500)
    try {
      const health = await (await fetch(`${base}/api/health`)).json()
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

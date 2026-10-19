import { execFileSync } from 'node:child_process'
import { existsSync, readlinkSync, renameSync, rmSync, symlinkSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { rootFromEnv, rootLayout } from '../server/src/layout.ts'
import { acquireProcessLock } from '../server/src/process.ts'
import { serverLabel, serverPort } from '../server/src/production.ts'
import { buildCommit, isHealthy } from './build.ts'
import { closeFinishedPreviews } from './previews.ts'

const { binosDir, buildsDir, logsDir, previewsDir } = rootLayout(rootFromEnv())
const repoDir = path.resolve(import.meta.dirname, '..')
const serverLog = path.join(logsDir, 'server.log')
const previousLink = path.join(buildsDir, 'previous')

const git = (...args: string[]) => execFileSync('git', args, { cwd: repoDir, encoding: 'utf8' }).trim()
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
  // 定时任务每分钟执行一次，顺带清理已合并或关闭的 PR 的预览；清理出错不影响上线
  await closeFinishedPreviews(previewsDir, repoDir, say).catch((err: unknown) => say(`清理预览出错：${String(err)}`))
  const commit = git('rev-parse', 'HEAD')
  // 定时任务每分钟执行一次，已经在运行时不输出，免得日志里每分钟多一行
  if (commitOf(binosDir) === commit) {
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
    buildCommit(repoDir, commit, path.join(buildsDir, commit))
  }
  await switchTo(commit)
} else {
  const previous = commitOf(previousLink)
  if (!previous) {
    throw new Error('没有可以回退的版本')
  }
  await switchTo(previous)
}

async function switchTo(commit: string) {
  const old = commitOf(binosDir)
  if (old === commit) {
    say(`已经在运行 ${short(commit)}`)
    return
  }
  if (await activate(commit)) {
    if (old) {
      pointTo(previousLink, path.join(buildsDir, old))
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
  pointTo(binosDir, path.join(buildsDir, commit))
  execFileSync('launchctl', ['kickstart', '-k', `gui/${os.userInfo().uid}/${serverLabel}`])
  return isHealthy(serverPort, commit)
}

// System/binos 指向正在运行的构建，builds/previous 指向上一个
function commitOf(linkPath: string): string | undefined {
  try {
    return path.basename(readlinkSync(linkPath))
  } catch {
    return undefined
  }
}

// 先建临时链接再改名，切换是一步完成的；链接里写相对路径，根目录搬家后仍然有效
function pointTo(linkPath: string, target: string) {
  rmSync(`${linkPath}.tmp`, { force: true })
  symlinkSync(path.relative(path.dirname(linkPath), target), `${linkPath}.tmp`)
  renameSync(`${linkPath}.tmp`, linkPath)
}

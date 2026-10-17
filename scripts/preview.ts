import { execFileSync, spawn } from 'node:child_process'
import { closeSync, existsSync, openSync, readdirSync, readFileSync, readlinkSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { rootFromEnv, rootLayout } from '../server/src/layout.ts'
import { previewInfoPath, previewUrl } from '../server/src/preview-info.ts'
import type { PreviewInfo } from '../server/src/preview-info.ts'
import { acquireProcessLock, isAlive, isRunning } from '../server/src/process.ts'
import type { ProcessIdentity } from '../server/src/process.ts'
import { buildCommit, isHealthy } from './build.ts'
import { freePort } from './net.ts'

const { previewsDir, claudeConfigDir } = rootLayout(rootFromEnv())
const repoDir = path.resolve(import.meta.dirname, '..')

const git = (...args: string[]) => execFileSync('git', args, { cwd: repoDir, encoding: 'utf8' }).trim()
const short = (commit: string) => commit.slice(0, 7)

const command = process.argv[2] ?? 'start'
if (command !== 'start' && command !== 'stop') {
  throw new Error('用法：pnpm preview [start | stop]')
}
const branch = git('branch', '--show-current')
if (!/^[a-z0-9-]+$/.test(branch) || branch === 'main') {
  throw new Error(`分支 ${branch || '（detached HEAD）'} 不能预览，只预览 worktree 里的改动分支`)
}
if (/^pr-\d+$/.test(branch)) {
  throw new Error(`分支名 ${branch} 留给 PR 的预览链接，换一个分支名`)
}
// 预览目录同时是预览实例的根目录：构建按提交放在里面，数据在它的 Library/ 里
const previewDir = path.join(previewsDir, branch)
const infoPath = previewInfoPath(previewsDir, branch)
const serverLock = path.join(rootLayout(previewDir).libraryDir, 'server.lock')
const serverLog = path.join(previewDir, 'server.log')

const holder = acquireProcessLock(path.join(previewDir, '.preview.lock'))
if (holder) {
  throw new Error(`${branch} 的预览正在由进程 ${holder.pid} 更新`)
}

if (command === 'stop') {
  await stopServer()
  for (const entry of readdirSync(previewsDir)) {
    if (/^pr-\d+$/.test(entry) && linkTarget(path.join(previewsDir, entry)) === branch) {
      rmSync(path.join(previewsDir, entry))
    }
  }
  rmSync(previewDir, { recursive: true, force: true })
  console.log(`已停止并删除 ${branch} 的预览`)
} else {
  await start()
}

async function start() {
  const commit = git('rev-parse', 'HEAD')
  if (git('status', '--porcelain')) {
    console.log('注意：工作区有未提交的改动，不包含在预览里')
  }
  if (readJson<PreviewInfo>(infoPath)?.commit === commit && runningServer()) {
    console.log(`预览已经是 ${short(commit)}`)
  } else if (await restart(commit)) {
    console.log(`✓ 预览 ${short(commit)}`)
  } else {
    console.log(`✗ ${short(commit)} 的预览没有正常启动，日志见 ${serverLog}`)
    process.exitCode = 1
    return
  }
  console.log(`分支 ${branch}：${previewUrl(branch)}`)
  const pr = linkPullRequest()
  if (pr) {
    console.log(`PR #${pr}：${previewUrl(`pr-${pr}`)}`)
  }
}

async function restart(commit: string) {
  const buildDir = path.join(previewDir, commit)
  if (!existsSync(buildDir)) {
    console.log(`构建 ${short(commit)}`)
    buildCommit(repoDir, commit, buildDir)
  }
  await stopServer()
  const port = await freePort()
  writeFileSync(infoPath, JSON.stringify({ port, commit } satisfies PreviewInfo) + '\n')
  startServer(buildDir, port)
  if (!(await isHealthy(port, commit))) {
    return false
  }
  for (const entry of readdirSync(previewDir)) {
    if (/^[0-9a-f]{40}$/.test(entry) && entry !== commit) {
      rmSync(path.join(previewDir, entry), { recursive: true, force: true })
    }
  }
  return true
}

// 分支有打开的 PR 时，pr-<编号> 链接到这个分支的预览目录，两个子域名看到的是同一个预览实例
function linkPullRequest(): number | undefined {
  let pr: number
  try {
    const jq = 'select(.state == "OPEN") | .number'
    pr = Number(execFileSync('gh', ['pr', 'view', branch, '--json', 'number,state', '--jq', jq], { cwd: repoDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim())
  } catch {
    // 没有 PR
    return undefined
  }
  if (!pr) {
    return undefined
  }
  const alias = path.join(previewsDir, `pr-${pr}`)
  rmSync(`${alias}.tmp`, { force: true })
  symlinkSync(branch, `${alias}.tmp`)
  renameSync(`${alias}.tmp`, alias)
  return pr
}

// 预览实例是测试实例：数据在预览目录里，借用正式版的 Claude Code 登录，agent 在这个 worktree 里工作。
// 自成一个进程组，启动它的 agent 和 session 结束后仍在运行
function startServer(buildDir: string, port: number) {
  const log = openSync(serverLog, 'a')
  try {
    const child = spawn(process.execPath, [path.join(buildDir, 'server', 'dist', 'index.js')], {
      cwd: previewDir,
      detached: true,
      stdio: ['ignore', log, log],
      env: {
        ...process.env,
        // 去掉包管理器运行脚本时临时加入的目录
        PATH: process.env.PATH!.split(':').filter((dir) => !dir.includes('node_modules')).join(':'),
        BINOS_ROOT: previewDir,
        BINOS_TEST_INSTANCE: '1',
        BINOS_CLAUDE_CONFIG_DIR: process.env.BINOS_CLAUDE_CONFIG_DIR ?? claudeConfigDir,
        BINOS_REPO_DIR: repoDir,
        PORT: String(port),
      },
    })
    child.unref()
  } finally {
    closeSync(log)
  }
}

function runningServer(): ProcessIdentity | undefined {
  const server = readJson<ProcessIdentity>(serverLock)
  return server && isRunning(server) ? server : undefined
}

async function stopServer() {
  const server = runningServer()
  if (!server) {
    return
  }
  process.kill(server.pid, 'SIGTERM')
  for (let i = 0; i < 100 && isAlive(server.pid); i++) {
    await sleep(100)
  }
  if (isAlive(server.pid)) {
    throw new Error(`预览实例（进程 ${server.pid}）10 秒内没有退出`)
  }
}

function linkTarget(file: string): string | undefined {
  try {
    return readlinkSync(file)
  } catch {
    return undefined
  }
}

function readJson<T>(file: string): T | undefined {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T
  } catch {
    return undefined
  }
}

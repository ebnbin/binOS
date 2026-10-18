import { execFileSync, spawn } from 'node:child_process'
import { closeSync, openSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { rootLayout } from '../server/src/layout.ts'
import { previewDirName } from '../server/src/preview-info.ts'
import { acquireProcessLock, isAlive, isRunning } from '../server/src/process.ts'
import type { ProcessIdentity } from '../server/src/process.ts'

// 预览目录同时是预览实例的根目录：构建按提交放在里面，数据在它的 Library/ 里
export function previewPaths(previewsDir: string, pr: number) {
  const dir = path.join(previewsDir, previewDirName(pr))
  return {
    dir,
    lock: path.join(dir, '.preview.lock'),
    serverLock: path.join(rootLayout(dir).libraryDir, 'server.lock'),
    serverLog: path.join(dir, 'server.log'),
  }
}

// 预览实例是测试实例：数据在预览目录里，借用正式版的 Claude Code 和 Codex 登录，agent 在 PR 的 worktree 里工作。
// 自成一个进程组，启动它的 agent 和 session 结束后仍在运行
export function startPreviewServer(options: {
  dir: string
  buildDir: string
  serverLog: string
  port: number
  repoDir: string
  claudeConfigDir: string
  codexHome: string
}) {
  const log = openSync(options.serverLog, 'a')
  try {
    const child = spawn(process.execPath, [path.join(options.buildDir, 'server', 'dist', 'index.js')], {
      cwd: options.dir,
      detached: true,
      stdio: ['ignore', log, log],
      env: {
        ...process.env,
        // 去掉包管理器运行脚本时临时加入的目录
        PATH: process.env.PATH!.split(':').filter((dir) => !dir.includes('node_modules')).join(':'),
        BINOS_ROOT: options.dir,
        BINOS_TEST_INSTANCE: '1',
        BINOS_CLAUDE_CONFIG_DIR: options.claudeConfigDir,
        BINOS_CODEX_HOME: options.codexHome,
        BINOS_REPO_DIR: options.repoDir,
        PORT: String(options.port),
      },
    })
    child.unref()
  } finally {
    closeSync(log)
  }
}

export function runningPreviewServer(serverLock: string): ProcessIdentity | undefined {
  const server = readJson<ProcessIdentity>(serverLock)
  return server && isRunning(server) ? server : undefined
}

export async function stopPreviewServer(serverLock: string) {
  const server = runningPreviewServer(serverLock)
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

// PR 合并或关闭后，停止并删除它的预览；查不到打开的 PR 时什么都不做，免得网络出错时误删
export async function closeFinishedPreviews(previewsDir: string, repoDir: string, say: (message: string) => void) {
  let open: Set<number>
  try {
    const numbers = execFileSync('gh', ['pr', 'list', '--state', 'open', '--limit', '1000', '--json', 'number', '--jq', '.[].number'], {
      cwd: repoDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    open = new Set(numbers.split('\n').filter(Boolean).map(Number))
  } catch {
    return
  }
  let entries: string[]
  try {
    entries = readdirSync(previewsDir)
  } catch {
    return
  }
  for (const entry of entries) {
    const pr = Number(/^pr-(\d+)$/.exec(entry)?.[1])
    if (!pr || open.has(pr)) {
      continue
    }
    const paths = previewPaths(previewsDir, pr)
    // 正在由 pnpm preview 更新的预览留到下一次
    if (acquireProcessLock(paths.lock)) {
      continue
    }
    await stopPreviewServer(paths.serverLock)
    rmSync(paths.dir, { recursive: true, force: true })
    say(`PR #${pr} 已合并或关闭，删除了它的预览`)
  }
}

export function readJson<T>(file: string): T | undefined {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T
  } catch {
    return undefined
  }
}

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { rootFromEnv, rootLayout } from '../server/src/layout.ts'
import { previewDirName, previewInfoPath, previewUrl } from '../server/src/preview-info.ts'
import type { PreviewInfo } from '../server/src/preview-info.ts'
import { acquireProcessLock } from '../server/src/process.ts'
import { buildCommit, isHealthy } from './build.ts'
import { freePort } from './net.ts'
import { previewPaths, readJson, runningPreviewServer, startPreviewServer, stopPreviewServer } from './previews.ts'

// 把当前分支的 PR 构建成预览；PR 合并或关闭后由上线脚本删除
const { previewsDir, claudeConfigDir } = rootLayout(rootFromEnv())
const repoDir = path.resolve(import.meta.dirname, '..')

const git = (...args: string[]) => execFileSync('git', args, { cwd: repoDir, encoding: 'utf8' }).trim()
const short = (commit: string) => commit.slice(0, 7)

const branch = git('branch', '--show-current')
let pr: { number: number; state: string; headRefOid: string }
try {
  pr = JSON.parse(
    execFileSync('gh', ['pr', 'view', branch, '--json', 'number,state,headRefOid'], {
      cwd: repoDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }),
  )
} catch {
  throw new Error(`分支 ${branch || '（detached HEAD）'} 还没有 PR，先推送并开 PR`)
}
if (pr.state !== 'OPEN') {
  throw new Error(`PR #${pr.number} 已经合并或关闭`)
}
// 预览和 PR 里的代码一致：只预览已经推送到 PR 的提交
const commit = git('rev-parse', 'HEAD')
if (commit !== pr.headRefOid) {
  throw new Error(`本地 HEAD ${short(commit)} 和 PR #${pr.number} 最新的提交 ${short(pr.headRefOid)} 不一致，先推送`)
}
if (git('status', '--porcelain')) {
  console.log('注意：工作区有未提交的改动，不包含在预览里')
}

const paths = previewPaths(previewsDir, pr.number)
const infoPath = previewInfoPath(previewsDir, previewDirName(pr.number))
const holder = acquireProcessLock(paths.lock)
if (holder) {
  throw new Error(`PR #${pr.number} 的预览正在由进程 ${holder.pid} 更新`)
}

if (readJson<PreviewInfo>(infoPath)?.commit === commit && runningPreviewServer(paths.serverLock)) {
  console.log(`PR #${pr.number} 的预览已经是 ${short(commit)}：${previewUrl(pr.number)}`)
  process.exit(0)
}
const buildDir = path.join(paths.dir, commit)
if (!existsSync(buildDir)) {
  console.log(`构建 ${short(commit)}`)
  buildCommit(repoDir, commit, buildDir)
}
await stopPreviewServer(paths.serverLock)
const port = await freePort()
writeFileSync(infoPath, JSON.stringify({ port, commit } satisfies PreviewInfo) + '\n')
startPreviewServer({
  dir: paths.dir,
  buildDir,
  serverLog: paths.serverLog,
  port,
  repoDir,
  claudeConfigDir: process.env.BINOS_CLAUDE_CONFIG_DIR ?? claudeConfigDir,
})
if (!(await isHealthy(port, commit))) {
  console.log(`✗ ${short(commit)} 的预览没有正常启动，日志见 ${paths.serverLog}`)
  process.exit(1)
}
for (const entry of readdirSync(paths.dir)) {
  if (/^[0-9a-f]{40}$/.test(entry) && entry !== commit) {
    rmSync(path.join(paths.dir, entry), { recursive: true, force: true })
  }
}
console.log(`✓ PR #${pr.number} 的预览 ${short(commit)}：${previewUrl(pr.number)}`)

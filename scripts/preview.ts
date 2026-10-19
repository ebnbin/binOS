import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { rootFromEnv, rootLayout } from '../server/src/layout.ts'
import { previewDirName, previewInfoPath, previewUrl } from '../server/src/preview-info.ts'
import type { PreviewInfo } from '../server/src/preview-info.ts'
import { acquireProcessLock } from '../server/src/process.ts'
import { buildCommit, isHealthy } from './build.ts'
import { freePort } from './net.ts'
import { previewPaths, readJson, runningPreviewServer, startPreviewServer, stopPreviewServer } from './previews.ts'

// 把当前分支的 PR 构建成预览；PR 合并或关闭后由上线脚本删除
const { previewsDir, agentsDir } = rootLayout(rootFromEnv())
const repoDir = path.resolve(import.meta.dirname, '..')

const git = (...args: string[]) => execFileSync('git', args, { cwd: repoDir, encoding: 'utf8' }).trim()
const short = (commit: string) => commit.slice(0, 7)

const fail = (message: string): never => {
  console.error(`✗ ${message}`)
  process.exit(1)
}

const branch = git('branch', '--show-current')
const commit = git('rev-parse', 'HEAD')
// 预览和 PR 里的代码一致：只预览已经推送的提交
let pushed: string | undefined
try {
  pushed = git('rev-parse', `refs/remotes/origin/${branch}`)
} catch {
  // 还没推送过
}
if (pushed !== commit) {
  fail(`本地 HEAD ${short(commit)} 还没有推送，先推送并开 PR`)
}
// 刚推送时 GitHub 上的 PR 要过几秒才更新到新提交
let pr = pullRequest()
for (let i = 0; i < 15 && pr?.state === 'OPEN' && pr.headRefOid !== commit; i++) {
  await sleep(2000)
  pr = pullRequest()
}
if (!pr) {
  fail(`分支 ${branch} 还没有 PR，先开 PR`)
}
const { number, state, headRefOid } = pr!
if (state !== 'OPEN') {
  fail(`PR #${number} 已经合并或关闭`)
}
if (headRefOid !== commit) {
  fail(`PR #${number} 最新的提交是 ${short(headRefOid)}，不是本地 HEAD ${short(commit)}`)
}

if (git('status', '--porcelain')) {
  console.log('注意：工作区有未提交的改动，不包含在预览里')
}

const paths = previewPaths(previewsDir, number)
const infoPath = previewInfoPath(previewsDir, previewDirName(number))
const holder = acquireProcessLock(paths.lock)
if (holder) {
  fail(`PR #${number} 的预览正在由进程 ${holder.pid} 更新`)
}

if (readJson<PreviewInfo>(infoPath)?.commit === commit && runningPreviewServer(paths.serverLock)) {
  console.log(`PR #${number} 的预览已经是 ${short(commit)}：${previewUrl(number)}`)
  process.exit(0)
}
const buildDir = path.join(paths.dir, commit)
if (!existsSync(buildDir)) {
  console.log(`构建 ${short(commit)}`)
  const workDir = `${buildDir}.tmp`
  rmSync(workDir, { recursive: true, force: true })
  try {
    renameSync(buildCommit(repoDir, commit, workDir), buildDir)
  } finally {
    rmSync(workDir, { recursive: true, force: true })
  }
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
  agentsDir: process.env.BINOS_AGENTS_DIR ?? agentsDir,
})
if (!(await isHealthy(port, commit))) {
  fail(`${short(commit)} 的预览没有正常启动，日志见 ${paths.serverLog}`)
}
for (const entry of readdirSync(paths.dir)) {
  if (/^[0-9a-f]{40}$/.test(entry) && entry !== commit) {
    rmSync(path.join(paths.dir, entry), { recursive: true, force: true })
  }
}
console.log(`✓ PR #${number} 的预览 ${short(commit)}：${previewUrl(number)}`)

function pullRequest(): { number: number; state: string; headRefOid: string } | undefined {
  try {
    return JSON.parse(
      execFileSync('gh', ['pr', 'view', branch, '--json', 'number,state,headRefOid'], {
        cwd: repoDir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }),
    )
  } catch {
    return undefined
  }
}

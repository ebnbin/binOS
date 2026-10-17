import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const run = (command: string, args: string[], cwd: string) => execFileSync(command, args, { cwd, stdio: 'inherit' })

// 在临时目录里构建完整的仓库，构建目录里只放运行需要的部分：server 和它的生产依赖、页面的构建产物
export function buildCommit(repoDir: string, commit: string, buildDir: string) {
  const staging = `${buildDir}.tmp`
  const source = path.join(staging, 'source')
  const output = path.join(staging, 'build')
  rmSync(staging, { recursive: true, force: true })
  mkdirSync(source, { recursive: true })
  try {
    // 只取这个提交里的代码，不混入工作区里未提交的改动
    const archive = path.join(staging, 'source.tar')
    execFileSync('git', ['archive', '--output', archive, commit], { cwd: repoDir })
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

export async function isHealthy(port: number, commit: string) {
  const base = `http://127.0.0.1:${port}`
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

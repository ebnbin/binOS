import { preparePty } from './prepare-pty.ts'
import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const run = (command: string, args: string[], cwd: string) => execFileSync(command, args, { cwd, stdio: 'inherit' })

// 在 workDir 里构建完整的仓库，返回构建结果的目录 workDir/build。构建结果里只放运行需要的部分：
// 命令行 bin/binos、server 和它的生产依赖、页面的构建产物。workDir 由调用方清理
export function buildCommit(repoDir: string, commit: string, workDir: string) {
  const source = path.join(workDir, 'source')
  const output = path.join(workDir, 'build')
  mkdirSync(source, { recursive: true })
  // 只取这个提交里的代码，不混入工作区里未提交的改动
  const archive = path.join(workDir, 'source.tar')
  execFileSync('git', ['archive', '--output', archive, commit], { cwd: repoDir })
  run('tar', ['-xf', archive, '-C', source], source)
  run('pnpm', ['install', '--frozen-lockfile'], source)
  run('pnpm', ['build'], source)
  run('pnpm', ['--filter', '@binos/server', '--prod', 'deploy', path.join(output, 'server')], source)
  preparePty(path.join(output, 'server', 'package.json'))
  cpSync(path.join(source, 'web', 'dist'), path.join(output, 'web', 'dist'), { recursive: true })
  cpSync(path.join(source, 'extensions'), path.join(output, 'extensions'), { recursive: true })
  cpSync(path.join(source, 'bin'), path.join(output, 'bin'), { recursive: true })
  writeFileSync(path.join(output, 'VERSION'), commit + '\n')
  return output
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

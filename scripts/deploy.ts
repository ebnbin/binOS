// 构建当前提交（HEAD），并切换为正式运行的版本：BINOS_ROOT=<根目录> npm run deploy
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readlinkSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const root = process.env.BINOS_ROOT
if (!root) {
  throw new Error('BINOS_ROOT is not set')
}
const repoDir = path.resolve(import.meta.dirname, '..')
const buildsDir = path.join(path.resolve(root), 'System', 'builds')

const git = (...args: string[]) => execFileSync('git', args, { cwd: repoDir, encoding: 'utf8' }).trim()
const run = (command: string, args: string[], cwd: string) => execFileSync(command, args, { cwd, stdio: 'inherit' })

const commit = git('rev-parse', 'HEAD')
const short = commit.slice(0, 7)
if (git('status', '--porcelain')) {
  console.log('注意：工作区有未提交的改动，不包含在这次构建里')
}

if (existsSync(path.join(buildsDir, commit))) {
  console.log(`${short} 已经构建过，直接切换`)
} else {
  build()
}
activate()
console.log(`当前版本：${short}，重启正式版后生效`)

function build() {
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

// current 指向新版本，原来的版本记为 previous
function activate() {
  const current = path.join(buildsDir, 'current')
  let previous: string | undefined
  try {
    previous = readlinkSync(current)
  } catch {
    previous = undefined
  }
  if (previous === commit) {
    return
  }
  link(commit, current)
  if (previous) {
    link(previous, path.join(buildsDir, 'previous'))
  }
}

// 先建临时链接再改名，切换是一步完成的；用相对路径，根目录搬家后链接仍然有效
function link(target: string, name: string) {
  const tmp = `${name}.tmp`
  rmSync(tmp, { force: true })
  symlinkSync(target, tmp)
  renameSync(tmp, name)
}

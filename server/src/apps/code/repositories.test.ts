import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'

const root = mkdtempSync(path.join(os.tmpdir(), 'code-repositories-'))
process.env.BINOS_ROOT = root
const { cloneRepository, parseRepository, projectRepoDir, repositoriesDir, prepareRepository } = await import('./repositories.js')
const { projectInstructions } = await import('./instructions.js')
const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
afterAll(() => rmSync(root, { recursive: true, force: true }))

describe('项目仓库', () => {
  it('识别 GitHub 仓库名、HTTPS 和 SSH 地址', () => {
    for (const input of ['owner/repo', 'https://github.com/owner/repo.git', 'git@github.com:owner/repo.git', 'https://github.com/owner/repo/']) {
      expect(parseRepository(input)).toBe('owner/repo')
    }
    for (const input of ['../repo', 'owner/..', 'owner/repo/extra', 'https://other.test/owner/repo', '-flag']) expect(parseRepository(input)).toBeUndefined()
  })

  it('独立裸仓库支持非 main 默认分支、fetch、任务 worktree 和 push', async () => {
    const source = path.join(root, 'source')
    git(root, 'init', '-b', 'develop', source)
    git(source, 'config', 'user.name', 'Test')
    git(source, 'config', 'user.email', 'test@example.com')
    writeFileSync(path.join(source, 'README.md'), 'initial')
    git(source, 'add', '.')
    git(source, 'commit', '-m', 'Initial')
    await cloneRepository('first', source, 'develop')
    await cloneRepository('second', source, 'develop')
    const first = projectRepoDir('first')
    const second = projectRepoDir('second')
    expect(git(first, 'branch', '--show-current')).toBe('develop')
    expect(git(first, 'rev-parse', '--abbrev-ref', '@{upstream}')).toBe('origin/develop')
    writeFileSync(path.join(source, 'README.md'), 'updated')
    git(source, 'commit', '-am', 'Update')
    git(first, 'fetch', 'origin')
    const task = path.join(repositoriesDir, 'first', 'feature')
    git(first, 'worktree', 'add', '-b', 'feature', task, 'origin/develop')
    expect(readFileSync(path.join(task, 'README.md'), 'utf8')).toBe('updated')
    expect(readFileSync(path.join(first, 'README.md'), 'utf8')).toBe('initial')
    expect(readFileSync(path.join(second, 'README.md'), 'utf8')).toBe('initial')
    git(task, 'push', '-u', 'origin', 'feature')
    expect(git(source, 'rev-parse', 'feature')).toBe(git(task, 'rev-parse', 'HEAD'))
    expect(git(second, 'branch', '--list', 'feature')).toBe('')
    const instructions = projectInstructions({ id: 'first', name: 'First', repository: 'example/first', defaultBranch: 'develop' }, first)
    expect(instructions).toContain('example/first')
    expect(instructions).toContain('develop')
    expect(instructions).toContain(first)
    expect(instructions).not.toContain('builds')
  })

  it('创建私有仓库后初始化本地仓库，失败时给出可重试方式', async () => {
    const bin = path.join(root, 'bin')
    mkdirSync(bin)
    const gh = path.join(bin, 'gh')
    const log = path.join(root, 'gh-calls.jsonl')
    writeFileSync(gh, `#!${process.execPath}
const fs = require('node:fs')
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify(process.argv.slice(2)) + '\\n')
if (process.argv[3] === 'view') process.stdout.write(process.env.CODE_TEST_REPO)
`)
    chmodSync(gh, 0o755)
    const previousPath = process.env.PATH
    process.env.PATH = `${bin}:${previousPath}`
    try {
      process.env.CODE_TEST_REPO = JSON.stringify({ nameWithOwner: 'Example/New', defaultBranchRef: { name: 'develop' }, url: path.join(root, 'source') })
      expect(await prepareRepository('new-project', 'example/new', true)).toEqual({ repository: 'Example/New', defaultBranch: 'develop' })
      expect(readFileSync(log, 'utf8')).toContain(JSON.stringify(['repo', 'create', 'example/new', '--private', '--add-readme']))
      process.env.CODE_TEST_REPO = JSON.stringify({ nameWithOwner: 'example/empty', defaultBranchRef: null })
      await expect(prepareRepository('empty', 'example/empty', false)).rejects.toThrow('仓库还没有提交')
      process.env.CODE_TEST_REPO = JSON.stringify({ nameWithOwner: 'example/broken', defaultBranchRef: { name: 'main' }, url: path.join(root, 'missing') })
      await expect(prepareRepository('broken', 'example/broken', true)).rejects.toThrow('已创建，但本地初始化失败')
      expect(existsSync(path.join(repositoriesDir, 'broken'))).toBe(false)
    } finally {
      process.env.PATH = previousPath
      delete process.env.CODE_TEST_REPO
    }
  })

  it('clone 失败时清理未完成的项目目录', async () => {
    await expect(cloneRepository('failed', path.join(root, 'missing'), 'main')).rejects.toThrow(/does not exist/)
    expect(existsSync(path.join(repositoriesDir, 'failed'))).toBe(false)
  })
})

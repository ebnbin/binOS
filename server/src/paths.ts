import path from 'node:path'

// 根目录由启动方式指定（BINOS_ROOT），不根据代码所在位置推断
const root = process.env.BINOS_ROOT
if (!root) {
  throw new Error('BINOS_ROOT is not set')
}

export const rootDir = path.resolve(root)
export const libraryDir = path.join(rootDir, 'Library')
// main 分支的克隆，session 的初始目录；改动在它旁边的 worktree 里进行
export const repoDir = path.join(rootDir, 'System', 'source', 'main')
// 当前运行的代码：开发时是仓库，正式版是 System/builds 下的某个版本
export const codeDir = path.resolve(import.meta.dirname, '../..')

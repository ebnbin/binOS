import path from 'node:path'

// 根目录由启动方式指定（BINOS_ROOT），不根据代码所在位置推断
const root = process.env.BINOS_ROOT
if (!root) {
  throw new Error('BINOS_ROOT is not set')
}

export const rootDir = path.resolve(root)
export const libraryDir = path.join(rootDir, 'Library')
// 代码仓库：agent 在这里改代码
export const repoDir = path.join(rootDir, 'binOS')
// 当前运行的代码：开发时是仓库，正式版是 System/builds 下的某个版本
export const codeDir = path.resolve(import.meta.dirname, '../..')

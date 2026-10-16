import path from 'node:path'

// 根目录由启动方式指定（BINOS_ROOT），不根据代码所在位置推断
const root = process.env.BINOS_ROOT
if (!root) {
  throw new Error('BINOS_ROOT is not set')
}

export const rootDir = path.resolve(root)
export const libraryDir = path.join(rootDir, 'Library')
export const repoDir = path.resolve(import.meta.dirname, '../..')

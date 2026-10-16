import path from 'node:path'

// 根目录由启动方式指定（BINOS_ROOT），不根据代码所在位置推断
const root = process.env.BINOS_ROOT
if (!root) {
  throw new Error('BINOS_ROOT is not set')
}

// 测试实例：本机启动、用于验证改动的实例，不校验身份，由 npm run dev 启动
export const isTestInstance = process.env.BINOS_TEST_INSTANCE === '1'

export const rootDir = path.resolve(root)
export const libraryDir = path.join(rootDir, 'Library')
// 当前运行的代码：测试实例是被测试的 worktree，正式版是 System/builds 下的某个版本
export const codeDir = path.resolve(import.meta.dirname, '../..')
// agent 的工作目录：正式版是 main 分支的克隆，改动在它旁边的 worktree 里进行；测试实例是被测试的 worktree
export const repoDir = isTestInstance ? codeDir : path.join(rootDir, 'System', 'source', 'main')
// agent 的 Claude Code 配置目录：测试实例借用正式版的，沿用它的登录
export const claudeConfigDir = process.env.BINOS_CLAUDE_CONFIG_DIR ?? path.join(libraryDir, 'claude')

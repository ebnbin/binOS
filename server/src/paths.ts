import path from 'node:path'
import { rootFromEnv, rootLayout } from './layout.js'

const layout = rootLayout(rootFromEnv())

export const isTestInstance = process.env.BINOS_TEST_INSTANCE === '1'

export const { libraryDir, sessionsDir, statePath, uploadsDir } = layout
// 当前运行的代码：测试实例是被测试的 worktree，正式版是 System/builds 下的某个版本
export const codeDir = path.resolve(import.meta.dirname, '../..')
// agent 的工作目录：正式版是 main/，测试实例是被测试的 worktree
export const repoDir = isTestInstance ? codeDir : layout.mainDir
// 测试实例借用正式版的 Claude Code 配置，沿用它的登录
export const claudeConfigDir = process.env.BINOS_CLAUDE_CONFIG_DIR ?? layout.claudeConfigDir

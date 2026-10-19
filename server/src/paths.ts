import path from 'node:path'
import { rootFromEnv, rootLayout } from './layout.js'

const layout = rootLayout(rootFromEnv())

export const isTestInstance = process.env.BINOS_TEST_INSTANCE === '1'

export const { agentRunsDir, libraryDir, previewsDir, sessionsDir, statePath, uploadsDir } = layout
// 当前运行的代码：测试实例是被测试的 worktree，正式版是 System/builds 下的某个版本
export const codeDir = path.resolve(import.meta.dirname, '../..')
// 喜多里 agent 的工作目录：正式版是 main/，测试实例是被测试的 worktree，预览由启动方指定为它的 worktree
export const repoDir = process.env.BINOS_REPO_DIR ?? (isTestInstance ? codeDir : layout.mainDir)
// agent 的登录和配置，每个 agent 一个子目录。测试实例和预览借用正式版的，沿用它们的登录。
// Claude Code 按配置目录路径的字符串区分钥匙串里的凭证，所以要规范成同一种写法
export const agentsDir = process.env.BINOS_AGENTS_DIR ? path.resolve(process.env.BINOS_AGENTS_DIR) : layout.agentsDir

import path from 'node:path'
import { codeDir, isTestInstance } from '../../paths.js'
import { dataDir } from './sessions.js'

// Code 管理的 git 仓库，一个仓库一个目录：里面的 .git 是仓库本身（裸仓库），其余每个子目录是它的一个 worktree
const repositoriesDir = path.join(dataDir, 'repositories')

// agent 的工作目录：正式版是 binos 仓库的 main，测试实例是被测试的 worktree，预览由启动方指定为它的 worktree
export const repoDir = process.env.BINOS_REPO_DIR ?? (isTestInstance ? codeDir : path.join(repositoriesDir, 'binos', 'main'))

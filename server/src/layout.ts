import path from 'node:path'

// binOS 根目录（BINOS_ROOT）下的目录结构，后端和脚本共用
export function rootLayout(root: string) {
  const rootDir = path.resolve(root)
  const libraryDir = path.join(rootDir, 'Library')
  return {
    rootDir,
    // main 分支的克隆，worktree 在它旁边
    mainDir: path.join(rootDir, 'System', 'source', 'main'),
    // 每个版本的构建，current、previous 指向正在运行的版本和上一个版本
    buildsDir: path.join(rootDir, 'System', 'builds'),
    libraryDir,
    logsDir: path.join(libraryDir, 'logs'),
    sessionsDir: path.join(libraryDir, 'agent', 'sessions'),
    claudeConfigDir: path.join(libraryDir, 'claude'),
  }
}

// 根目录由启动方式指定，不根据代码所在位置推断
export function rootFromEnv(): string {
  const root = process.env.BINOS_ROOT
  if (!root) {
    throw new Error('BINOS_ROOT is not set')
  }
  return root
}

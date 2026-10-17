import path from 'node:path'

export function rootLayout(root: string) {
  const rootDir = path.resolve(root)
  const libraryDir = path.join(rootDir, 'Library')
  return {
    rootDir,
    mainDir: path.join(rootDir, 'System', 'source', 'main'),
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

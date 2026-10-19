import path from 'node:path'

export function rootLayout(root: string) {
  const rootDir = path.resolve(root)
  const libraryDir = path.join(rootDir, 'Library')
  return {
    rootDir,
    mainDir: path.join(rootDir, 'System', 'source', 'main'),
    buildsDir: path.join(rootDir, 'System', 'builds'),
    previewsDir: path.join(rootDir, 'System', 'previews'),
    libraryDir,
    // 第三方 agent 自己的目录，每个 agent 一个子目录
    agentsDir: path.join(rootDir, 'Agents'),
    logsDir: path.join(libraryDir, 'logs'),
    statePath: path.join(libraryDir, 'state.json'),
    agentRunsDir: path.join(libraryDir, 'agent', 'runs'),
    appsDir: path.join(libraryDir, 'Apps'),
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

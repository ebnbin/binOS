import path from 'node:path'

export function rootLayout(root: string) {
  const rootDir = path.resolve(root)
  const libraryDir = path.join(rootDir, 'Library')
  return {
    rootDir,
    // 正在运行的 binOS：指向 builds/ 里的某个构建，launchd 运行其中的 bin/binos
    binOSDir: path.join(rootDir, 'System', 'binOS'),
    mainDir: path.join(rootDir, 'System', 'source', 'main'),
    buildsDir: path.join(rootDir, 'System', 'builds'),
    previewsDir: path.join(rootDir, 'System', 'previews'),
    libraryDir,
    // 第三方 agent 自己的目录，每个 agent 一个子目录
    agentsDir: path.join(rootDir, 'Agents'),
    // launchd 服务的输出，一个服务一个文件。Library/binOS 是 binOS 系统自己的数据
    logsDir: path.join(libraryDir, 'binOS', 'logs'),
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

import path from 'node:path'

export function rootLayout(root: string) {
  const rootDir = path.resolve(root)
  const libraryDir = path.join(rootDir, 'Library')
  return {
    rootDir,
    // 正在运行的 binOS：上线服务装进来的构建，launchd 运行其中的 bin/binos
    binosDir: path.join(rootDir, 'System', 'binos'),
    previewsDir: path.join(rootDir, 'System', 'previews'),
    libraryDir,
    // 第三方 agent 自己的目录，每个 agent 一个子目录
    agentsDir: path.join(rootDir, 'Agents'),
    // launchd 服务的输出，一个服务一个文件。Library/binos 是 binOS 系统自己的数据
    logsDir: path.join(libraryDir, 'binos', 'logs'),
    statePath: path.join(libraryDir, 'state.json'),
    agentRunsDir: path.join(libraryDir, 'agent', 'runs'),
    appsDir: path.join(libraryDir, 'Apps'),
    // 上线服务的数据：上一个版本、上线过程中的临时文件、上线失败的提交和锁
    deployDir: path.join(libraryDir, 'Services', 'deploy'),
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

import { spawn } from 'node:child_process'
import { closeSync, openSync } from 'node:fs'
import { claudeConfigDir, repoDir } from './paths.js'

// 启动一轮回答的 claude 进程，返回进程号；启动失败返回 undefined。
// 输出直接写进文件，自成一个进程组：后端重启时 launchd 结束的是后端所在的进程组，agent 不受影响，后端重启后接着读文件
export function spawnClaude(options: {
  prompt: string
  claudeSessionId: string
  // Claude 的会话已经建立时接续它，否则用这个 ID 新建
  resume: boolean
  outputPath: string
  errorsPath: string
}): number | undefined {
  const stdout = openSync(options.outputPath, 'w')
  const stderr = openSync(options.errorsPath, 'w')
  try {
    const child = spawn(
      'claude',
      [
        '-p', options.prompt,
        '--permission-mode', 'bypassPermissions',
        '--output-format', 'stream-json',
        '--verbose',
        '--include-partial-messages',
        options.resume ? '--resume' : '--session-id', options.claudeSessionId,
      ],
      { cwd: repoDir, env: agentEnv(), stdio: ['ignore', stdout, stderr], detached: true },
    )
    child.on('error', () => {})
    child.unref()
    return child.pid
  } finally {
    closeSync(stdout)
    closeSync(stderr)
  }
}

// 不继承启动后端的环境里与 Claude 相关的设置，只指定 binOS 自己的配置目录
function agentEnv(): NodeJS.ProcessEnv {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('CLAUDE') && !key.startsWith('ANTHROPIC')),
  )
  return { ...env, CLAUDE_CONFIG_DIR: claudeConfigDir }
}

import { spawn } from 'node:child_process'
import { closeSync, openSync } from 'node:fs'
import { claudeConfigDir, repoDir } from '../../paths.js'
import { replyFilesPrompt } from './reply-files.js'

// 输出直接写进文件，自成一个进程组：后端重启时 launchd 结束的是后端所在的进程组，agent 不受影响，后端重启后接着读文件
export function spawnClaude(options: {
  prompt: string
  claudeSessionId: string
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
        '--append-system-prompt', replyFilesPrompt,
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

// 后端可能是从 Claude Code 里启动的（比如测试实例），agent 不能继承那里的 Claude 设置
function agentEnv(): NodeJS.ProcessEnv {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('CLAUDE') && !key.startsWith('ANTHROPIC')),
  )
  return { ...env, CLAUDE_CONFIG_DIR: claudeConfigDir }
}

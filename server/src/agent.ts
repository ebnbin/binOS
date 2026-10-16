import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { libraryDir, repoDir } from './paths.js'

export type Task =
  | { status: 'running' }
  | { status: 'done'; reply: string }
  | { status: 'failed'; error: string }

const tasks = new Map<string, Task>()
let running = false

// 启动一次 agent，立即返回任务编号；已有任务在运行时返回 undefined
export function startTask(message: string): string | undefined {
  if (running) {
    return undefined
  }
  running = true
  const id = randomUUID()
  tasks.set(id, { status: 'running' })

  const child = spawn(
    'claude',
    ['-p', message, '--permission-mode', 'bypassPermissions', '--output-format', 'json'],
    { cwd: repoDir, env: agentEnv(), stdio: ['ignore', 'pipe', 'pipe'] },
  )
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => (stdout += chunk))
  child.stderr.on('data', (chunk) => (stderr += chunk))

  const finish = (task: Task) => {
    tasks.set(id, task)
    running = false
  }
  child.on('error', (err) => finish({ status: 'failed', error: err.message }))
  child.on('close', (code) => {
    try {
      const result = JSON.parse(stdout)
      if (result.is_error) {
        finish({ status: 'failed', error: String(result.result ?? result.subtype) })
      } else {
        finish({ status: 'done', reply: String(result.result) })
      }
    } catch {
      finish({ status: 'failed', error: stderr.trim() || `agent exited with code ${code}` })
    }
  })
  return id
}

export function getTask(id: string): Task | undefined {
  return tasks.get(id)
}

// 不继承启动后端的环境里与 Claude 相关的设置，只指定 binOS 自己的配置目录
function agentEnv() {
  const env: NodeJS.ProcessEnv = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith('CLAUDE') && !key.startsWith('ANTHROPIC')) {
      env[key] = value
    }
  }
  env.CLAUDE_CONFIG_DIR = path.join(libraryDir, 'claude')
  return env
}

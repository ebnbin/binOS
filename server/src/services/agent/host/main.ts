import { appendFileSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import path from 'node:path'
import { claudeHost } from '../drivers/claude/host.js'
import { codexHost } from '../drivers/codex/host.js'
import type { HostAgentRunner, HostCommand, HostLaunch, HostReply } from './protocol.js'

// host 进程：持有一个 agent 进程，替后端把命令交给它，把它的输出写进文件。
// 自成一个进程组，后端重启时不受影响；新的后端从文件里接着读输出，连上同一个 socket 接着发命令。
// 只依赖 Node 自带的模块和 host 的约定，启动时一次加载完：上线替换掉代码目录也不影响正在运行的 host
const runners: Record<HostLaunch['agent'], HostAgentRunner> = { claude: claudeHost, codex: codexHost }

const launch: HostLaunch = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const runner = runners[launch.agent]

// 命令一条条按收到的顺序交给 agent
let queue: Promise<unknown> = Promise.resolve()

const socket = createServer((connection) => {
  connection.setEncoding('utf8')
  let buffer = ''
  connection.on('data', (chunk: string) => {
    buffer += chunk
    const end = buffer.indexOf('\n')
    if (end < 0) {
      return
    }
    const line = buffer.slice(0, end)
    buffer = ''
    let command: HostCommand
    try {
      command = JSON.parse(line)
    } catch {
      connection.end(JSON.stringify({ ok: false, error: '看不懂的命令' } satisfies HostReply) + '\n')
      return
    }
    const handled = queue.then(() => runner.handle(command)).catch((error: unknown) => ({ ok: false as const, error: String(error) }))
    queue = handled
    void handled.then((reply) => connection.end(JSON.stringify(reply) + '\n'))
  })
  connection.on('error', () => {})
})

function exit(code: number) {
  socket.close()
  rmSync(launch.socket, { force: true })
  process.exit(code)
}

// host 的目录没了（预览被删、worktree 被删），不会再有后端来管它：结束整个进程组
setInterval(() => {
  if (!existsSync(path.dirname(process.argv[2]))) {
    rmSync(launch.socket, { force: true })
    process.kill(-process.pid, 'SIGTERM')
  }
}, 30_000).unref()

rmSync(launch.socket, { force: true })
socket.listen(launch.socket)
runner.start(launch.args, {
  output: (line) => appendFileSync(launch.output, line + '\n'),
  error: (text) => appendFileSync(launch.errors, text.endsWith('\n') ? text : text + '\n'),
  exit,
})
process.on('SIGTERM', () => exit(143))

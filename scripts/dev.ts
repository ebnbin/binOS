// 用这个 worktree 的代码启动一个测试实例：npm run dev
// 数据放在 .test-instance/ 下，端口自动分配；agent 借用正式版的 Claude Code 配置
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { rootLayout } from '../server/src/layout.ts'

const worktreeDir = path.resolve(import.meta.dirname, '..')
const rootDir = path.join(worktreeDir, '.test-instance')

const claudeConfigDir =
  process.env.BINOS_CLAUDE_CONFIG_DIR ?? (process.env.BINOS_ROOT && rootLayout(process.env.BINOS_ROOT).claudeConfigDir)
if (!claudeConfigDir) {
  throw new Error('需要 BINOS_ROOT（正式版的根目录）或 BINOS_CLAUDE_CONFIG_DIR，用来借用 Claude Code 的登录')
}

mkdirSync(rootDir, { recursive: true })
const serverPort = await freePort()
const webPort = await freePort()

const children = [
  spawn('npm', ['run', 'dev', '-w', '@binos/server'], {
    cwd: worktreeDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      BINOS_ROOT: rootDir,
      BINOS_TEST_INSTANCE: '1',
      BINOS_CLAUDE_CONFIG_DIR: claudeConfigDir,
      PORT: String(serverPort),
    },
  }),
  spawn('npm', ['run', 'dev', '-w', '@binos/web', '--', '--port', String(webPort), '--strictPort'], {
    cwd: worktreeDir,
    stdio: 'inherit',
    env: { ...process.env, BINOS_SERVER_PORT: String(serverPort) },
  }),
]

console.log(`测试实例：页面 http://localhost:${webPort}，接口 http://127.0.0.1:${serverPort}/api，数据 ${rootDir}`)

// 任何一个退出或收到结束信号，就把两个都结束
const stop = () => {
  for (const child of children) {
    child.kill('SIGTERM')
  }
}
for (const child of children) {
  child.on('exit', stop)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as net.AddressInfo
      server.close(() => resolve(port))
    })
  })
}

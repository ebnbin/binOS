import { spawn } from 'node:child_process'
import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import type { HostAgentRunner, HostCommand, HostReply } from '../../host/protocol.js'

// 在 host 进程里运行：只依赖 Node 自带的模块和 host 的约定，启动时一次加载完。
// claude 的标准输入一直开着，收 stream-json 格式的消息：答完一轮后照样能收下一句，标准输入结束才退出
let agent: ChildProcessWithoutNullStreams | undefined

function write(message: object): Promise<HostReply> {
  return new Promise((resolve) => {
    if (!agent || agent.stdin.writableEnded) {
      resolve({ ok: false, error: 'agent 已经不再接收消息' })
      return
    }
    agent.stdin.write(JSON.stringify(message) + '\n', (error) => resolve(error ? { ok: false, error: error.message } : { ok: true }))
  })
}

export const claudeHost: HostAgentRunner = {
  start(args, io) {
    const [command, ...rest] = args as string[]
    agent = spawn(command, rest, { stdio: ['pipe', 'pipe', 'pipe'] })
    agent.on('error', (error) => {
      io.error(`claude 启动失败：${error.message}`)
      io.exit(1)
    })
    agent.stdout.setEncoding('utf8')
    let buffer = ''
    agent.stdout.on('data', (chunk: string) => {
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop()!
      lines.forEach(io.output)
    })
    agent.stderr.setEncoding('utf8').on('data', io.error)
    agent.on('close', (code) => {
      if (buffer) {
        io.output(buffer)
      }
      io.exit(code ?? 1)
    })
  },

  handle(command: HostCommand) {
    switch (command.type) {
      case 'message':
        return write({ type: 'user', message: { role: 'user', content: command.text } })
      // 停下正在做的事（正在运行的命令也会被中止），之后发的消息马上处理
      case 'interrupt':
        return write({ type: 'control_request', request_id: crypto.randomUUID(), request: { subtype: 'interrupt' } })
      case 'close':
        agent?.stdin.end()
        return Promise.resolve({ ok: true })
    }
  },
}

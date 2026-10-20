import { spawn } from 'node:child_process'
import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import { createInterface } from 'node:readline'
import type { HostAgentRunner, HostCommand, HostReply } from '../../host/protocol.js'

// 在 host 进程里运行：只依赖 Node 自带的模块和 host 的约定，启动时一次加载完。
// 持有一个 codex app-server，用 JSON-RPC 建立或接上会话，命令转成对应的请求；app-server 的输出原样交给 host

// thread：接着这个会话，没有就开一个新的；instructions：追加的系统提示；mcpServers：另外给它的 MCP 服务
export type CodexHostArgs = {
  thread?: string
  model?: string
  effort?: string
  instructions: string
  mcpServers: Record<string, { command: string; args: string[]; env: Record<string, string> }>
}
type Response = { id?: number; result?: { thread?: { id: string } }; error?: { message?: string } }
type Notification = { method?: string; params?: { threadId?: string; turn?: { id: string } } }

// 不需要确认、不加沙箱，和 Claude 的 bypassPermissions 一样
const permissions = { approvalPolicy: 'never', sandbox: 'danger-full-access' } as const

let server: ChildProcessWithoutNullStreams | undefined
let options: CodexHostArgs
let nextId = 0
const waiting = new Map<number, (response: Response) => void>()
let thread: string | undefined
// 会话建立好之前收到的命令等着
let ready: Promise<void> | undefined
let activeTurn: string | undefined
let turnEnded: (() => void) | undefined

function request(method: string, params: unknown): Promise<Response> {
  const id = ++nextId
  server!.stdin.write(JSON.stringify({ id, method, params }) + '\n')
  return new Promise((resolve) => waiting.set(id, resolve))
}

function turnFinished(): Promise<void> {
  return activeTurn === undefined ? Promise.resolve() : new Promise((resolve) => (turnEnded = resolve))
}

async function establish(fail: (message: string) => void) {
  const init = await request('initialize', { clientInfo: { name: 'binos', title: 'binOS', version: '1' }, capabilities: null })
  if (init.error) {
    fail(`codex 初始化失败：${init.error.message ?? ''}`)
    return
  }
  server!.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n')
  const params = {
    cwd: process.cwd(),
    ...permissions,
    developerInstructions: options.instructions,
    // 默认不给思考的摘要
    config: { model_reasoning_summary: 'detailed', mcp_servers: options.mcpServers },
    ...(options.model && { model: options.model }),
  }
  const response = options.thread
    ? await request('thread/resume', { threadId: options.thread, ...params, excludeTurns: true })
    : await request('thread/start', params)
  thread = response.result?.thread?.id
  if (!thread) {
    fail(`codex 会话${options.thread ? '接不上' : '建立失败'}：${response.error?.message ?? ''}`)
  }
}

async function message(text: string): Promise<HostReply> {
  // 正在回答时 turn/start 把这句话交给进行中的这一轮
  const response = await request('turn/start', {
    threadId: thread,
    input: [{ type: 'text', text, text_elements: [] }],
    ...(options.effort && { effort: options.effort }),
  })
  return response.error ? { ok: false, error: `消息没能交给 codex：${response.error.message ?? ''}` } : { ok: true }
}

export const codexHost: HostAgentRunner = {
  start(args, io) {
    options = args as CodexHostArgs
    server = spawn('codex', ['app-server'], { stdio: ['pipe', 'pipe', 'pipe'] })
    const fail = (text: string) => {
      io.error(text)
      server?.kill()
    }
    server.on('error', (error) => {
      io.error(`codex 启动失败：${error.message}`)
      io.exit(1)
    })
    server.stderr.setEncoding('utf8').on('data', io.error)
    server.on('close', (code) => io.exit(code ?? 1))
    createInterface({ input: server.stdout }).on('line', (line) => {
      io.output(line)
      let parsed: Response & Notification
      try {
        parsed = JSON.parse(line)
      } catch {
        return
      }
      if (parsed.id !== undefined && !parsed.method) {
        waiting.get(parsed.id)?.(parsed)
        waiting.delete(parsed.id)
        return
      }
      // 子 agent 的会话也在同一个连接上，只看自己的
      if (parsed.params?.threadId !== thread) {
        return
      }
      if (parsed.method === 'turn/started') {
        activeTurn = parsed.params?.turn?.id
      } else if (parsed.method === 'turn/completed') {
        activeTurn = undefined
        turnEnded?.()
      }
    })
    ready = establish(fail)
  },

  async handle(command: HostCommand) {
    await ready
    if (!thread) {
      return { ok: false, error: 'codex 会话没有建立' }
    }
    switch (command.type) {
      case 'message':
        return message(command.text)
      case 'interrupt':
        if (activeTurn !== undefined) {
          await request('turn/interrupt', { threadId: thread, turnId: activeTurn })
          await turnFinished()
        }
        return { ok: true }
      // 等手上的这一轮答完再让 app-server 退出
      case 'close':
        void turnFinished().then(() => server?.stdin.end())
        return { ok: true }
    }
  },
}

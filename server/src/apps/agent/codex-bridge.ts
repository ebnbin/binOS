// 在 agent 的位置上运行的转接进程：标准输入收 binOS 发给 Claude 的那种消息（user、interrupt），
// 转成 codex app-server 的 JSON-RPC 请求；app-server 的输出原样写到标准输出。
// 标准输入结束后，等手上的消息处理完、这一轮答完再退出，和 Claude 一样。
// 由后端用 node 直接运行（开发时是 .ts），只依赖 Node 自带的模块
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

// threadId：接着这个会话；没有就开一个新的
type Options = { threadId?: string; model?: string; effort?: string; instructions: string }
type Command = { type: 'user'; text: string } | { type: 'interrupt' }
type Response = { id?: number; result?: { thread?: { id: string } }; error?: { message?: string } }
type Notification = { method?: string; params?: { threadId?: string; turn?: { id: string } } }

const options: Options = JSON.parse(process.argv[2] ?? '{}')
// 不需要确认、不加沙箱，对应 Claude 的 bypassPermissions
const permissions = { approvalPolicy: 'never', sandbox: 'danger-full-access' } as const

const server = spawn('codex', ['app-server'], { stdio: ['pipe', 'pipe', 'inherit'] })
server.on('error', (error) => fail(`codex 启动失败：${error.message}`))

let nextId = 0
const waiting = new Map<number, (response: Response) => void>()
let threadId: string | undefined
let activeTurn: string | undefined
let turnEnded: (() => void) | undefined

function fail(message: string): never {
  process.stderr.write(message + '\n')
  server.kill()
  process.exit(1)
}

function request(method: string, params: unknown): Promise<Response> {
  const id = ++nextId
  server.stdin.write(JSON.stringify({ id, method, params }) + '\n')
  return new Promise((resolve) => waiting.set(id, resolve))
}

createInterface({ input: server.stdout }).on('line', (line) => {
  process.stdout.write(line + '\n')
  let message: Response & Notification
  try {
    message = JSON.parse(line)
  } catch {
    return
  }
  if (message.id !== undefined && !message.method) {
    waiting.get(message.id)?.(message)
    waiting.delete(message.id)
    return
  }
  // 子 agent 的会话也在同一个连接上，只看自己的
  if (message.params?.threadId !== threadId) {
    return
  }
  if (message.method === 'turn/started') {
    activeTurn = message.params?.turn?.id
  } else if (message.method === 'turn/completed') {
    activeTurn = undefined
    turnEnded?.()
  }
})

function turnFinished(): Promise<void> {
  return activeTurn === undefined ? Promise.resolve() : new Promise((resolve) => (turnEnded = resolve))
}

async function handle(command: Command) {
  if (command.type === 'interrupt') {
    if (activeTurn !== undefined) {
      await request('turn/interrupt', { threadId, turnId: activeTurn })
      await turnFinished()
    }
    return
  }
  // 正在回答时 turn/start 把这句话交给进行中的这一轮
  const response = await request('turn/start', {
    threadId,
    input: [{ type: 'text', text: command.text, text_elements: [] }],
    ...(options.effort && { effort: options.effort }),
  })
  if (response.error) {
    process.stderr.write(`消息没能交给 codex：${response.error.message ?? ''}\n`)
  }
}

function parse(line: string): Command | undefined {
  try {
    const message = JSON.parse(line)
    if (message.type === 'user' && typeof message.message?.content === 'string') {
      return { type: 'user', text: message.message.content }
    }
    if (message.type === 'control_request' && message.request?.subtype === 'interrupt') {
      return { type: 'interrupt' }
    }
  } catch {
    // 不认识的行
  }
  return undefined
}

async function main() {
  const commands: Command[] = []
  let wake: (() => void) | undefined
  let inputEnded = false
  // 先收下标准输入，会话建立好之后再按顺序处理
  createInterface({ input: process.stdin })
    .on('line', (line) => {
      const command = parse(line)
      if (command) {
        commands.push(command)
        wake?.()
      }
    })
    .on('close', () => {
      inputEnded = true
      wake?.()
    })

  const init = await request('initialize', { clientInfo: { name: 'binos', title: 'binOS', version: '1' }, capabilities: null })
  if (init.error) {
    fail(`codex 初始化失败：${init.error.message ?? ''}`)
  }
  server.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n')
  const params = {
    cwd: process.cwd(),
    ...permissions,
    developerInstructions: options.instructions,
    // 默认不给思考的摘要
    config: { model_reasoning_summary: 'detailed' },
    ...(options.model && { model: options.model }),
  }
  const thread = options.threadId
    ? await request('thread/resume', { threadId: options.threadId, ...params, excludeTurns: true })
    : await request('thread/start', params)
  threadId = thread.result?.thread?.id
  if (!threadId) {
    fail(`codex 会话${options.threadId ? '接不上' : '建立失败'}：${thread.error?.message ?? ''}`)
  }

  for (;;) {
    const command = commands.shift()
    if (command) {
      await handle(command)
      continue
    }
    if (inputEnded) {
      break
    }
    await new Promise<void>((resolve) => (wake = resolve))
    wake = undefined
  }
  await turnFinished()
  server.stdin.end()
}

server.on('exit', (code) => process.exit(code ?? 1))
main().catch((error: unknown) => fail(String(error)))

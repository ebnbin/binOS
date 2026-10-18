import { spawn } from 'node:child_process'
import type { Readable, Writable } from 'node:stream'

const chromePath = process.env.BINOS_CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

export type CdpEvent = { method: string; params: Record<string, unknown>; sessionId?: string }

export type Chrome = {
  send<T = Record<string, unknown>>(method: string, params?: Record<string, unknown>, sessionId?: string): Promise<T>
  onEvent(listener: (event: CdpEvent) => void): void
  onExit(listener: () => void): void
}

// 通过 pipe 而不是端口连接 DevTools：本机其他程序连不上它。管道断开时 Chrome 自己退出，后端重启不会留下孤儿进程
export function launchChrome(profileDir: string): Chrome {
  const child = spawn(
    chromePath,
    [
      '--headless',
      '--remote-debugging-pipe',
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--lang=zh-CN',
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] },
  )
  const input = child.stdio[3] as Writable
  const output = child.stdio[4] as Readable

  let nextId = 0
  const pending = new Map<number, { resolve: (result: unknown) => void; reject: (error: Error) => void }>()
  const eventListeners: ((event: CdpEvent) => void)[] = []
  const exitListeners: (() => void)[] = []
  let exited = false

  // 消息之间用 \0 分隔
  let buffer = ''
  output.setEncoding('utf8')
  output.on('data', (chunk: string) => {
    buffer += chunk
    let end
    while ((end = buffer.indexOf('\0')) >= 0) {
      const message = JSON.parse(buffer.slice(0, end))
      buffer = buffer.slice(end + 1)
      if (message.id !== undefined) {
        const request = pending.get(message.id)
        pending.delete(message.id)
        if (message.error) {
          request?.reject(new Error(`${message.error.message}（${message.error.code}）`))
        } else {
          request?.resolve(message.result)
        }
      } else {
        eventListeners.forEach((listener) => listener(message))
      }
    }
  })

  const exit = () => {
    if (exited) {
      return
    }
    exited = true
    pending.forEach((request) => request.reject(new Error('Chrome 已退出')))
    pending.clear()
    exitListeners.forEach((listener) => listener())
  }
  child.on('exit', exit)
  child.on('error', exit)
  input.on('error', exit)

  return {
    send(method, params = {}, sessionId) {
      if (exited) {
        return Promise.reject(new Error('Chrome 已退出'))
      }
      const id = ++nextId
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve: resolve as (result: unknown) => void, reject })
        input.write(JSON.stringify({ id, method, params, sessionId }) + '\0')
      })
    },
    onEvent: (listener) => void eventListeners.push(listener),
    onExit: (listener) => void exitListeners.push(listener),
  }
}

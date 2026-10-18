import { readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// 在 chrome://inspect/#remote-debugging 开启远程调试后，Chrome 把端口和路径写在这里
const activePortFile = path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome', 'DevToolsActivePort')

export type CdpEvent = { method: string; params: Record<string, unknown>; sessionId?: string }

export type Chrome = {
  send<T = Record<string, unknown>>(method: string, params?: Record<string, unknown>, sessionId?: string): Promise<T>
  onEvent(listener: (event: CdpEvent) => void): void
  onClose(listener: () => void): void
}

export class ChromeUnavailable extends Error {}

// 连接用户自己正在用的 Chrome。每次建立连接，Chrome 都会弹窗请用户允许，允许之前连接一直挂起
export async function connectChrome(): Promise<Chrome> {
  let url: string
  try {
    const [port, wsPath] = readFileSync(activePortFile, 'utf8').trim().split('\n')
    url = `ws://127.0.0.1:${port}${wsPath}`
  } catch {
    throw new ChromeUnavailable('没有开启远程调试')
  }
  const socket = new WebSocket(url)
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener('open', () => resolve(), { once: true })
    socket.addEventListener('close', () => reject(new ChromeUnavailable('Chrome 没有运行，或者拒绝了连接')), { once: true })
  })

  let nextId = 0
  const pending = new Map<number, { resolve: (result: unknown) => void; reject: (error: Error) => void }>()
  const eventListeners: ((event: CdpEvent) => void)[] = []
  const closeListeners: (() => void)[] = []
  let closed = false

  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(String(data))
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
  })
  socket.addEventListener('close', () => {
    closed = true
    pending.forEach((request) => request.reject(new Error('和 Chrome 的连接已断开')))
    pending.clear()
    closeListeners.forEach((listener) => listener())
  })

  return {
    send(method, params = {}, sessionId) {
      if (closed) {
        return Promise.reject(new Error('和 Chrome 的连接已断开'))
      }
      const id = ++nextId
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve: resolve as (result: unknown) => void, reject })
        socket.send(JSON.stringify({ id, method, params, sessionId }))
      })
    },
    onEvent: (listener) => void eventListeners.push(listener),
    onClose: (listener) => void closeListeners.push(listener),
  }
}

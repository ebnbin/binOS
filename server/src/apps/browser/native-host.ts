import type { IncomingMessage } from 'node:http'
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { WebSocket, WebSocketServer } from 'ws'
import { relayDir } from './relay-path.js'

const directory = relayDir()
mkdirSync(directory, { recursive: true, mode: 0o700 })
const token = randomBytes(32).toString('hex')
const file = path.join(directory, 'relay.json')
const clients = new Map<string, WebSocket>()
const server = new WebSocketServer({ host: '127.0.0.1', port: 0, maxPayload: 16 << 20, verifyClient: ({ req }: { req: IncomingMessage }) => {
  if (req.headers.origin) return false
  const supplied = new URL(req.url!, 'http://localhost').searchParams.get('token') ?? ''
  return /^[a-f0-9]{64}$/.test(supplied) && timingSafeEqual(Buffer.from(supplied), Buffer.from(token))
} })
function send(value: unknown) {
  const message = Buffer.from(JSON.stringify(value))
  if (message.length > 1024 * 1024) throw new Error('Native browser command too large')
  const header = Buffer.alloc(4)
  header.writeUInt32LE(message.length)
  process.stdout.write(Buffer.concat([header, message]))
}
server.on('listening', () => {
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Browser relay did not start')
  writeFileSync(file, JSON.stringify({ port: address.port, token, pid: process.pid }), { mode: 0o600 })
})
server.on('connection', ws => {
  const id = randomUUID()
  clients.set(id, ws)
  ws.on('message', raw => {
    try { send({ clientId: id, message: JSON.parse(raw.toString()) }) }
    catch { ws.close(1008) }
  })
  ws.on('close', () => { clients.delete(id); send({ clientId: id, close: true }) })
  ws.on('error', () => ws.close())
})
let buffered = Buffer.alloc(0)
process.stdin.on('data', (chunk: Buffer) => {
  buffered = Buffer.concat([buffered, chunk])
  while (buffered.length >= 4) {
    const length = buffered.readUInt32LE(0)
    if (length > 32 << 20) return process.exit(1)
    if (buffered.length < length + 4) return
    try {
      const { clientId, message } = JSON.parse(buffered.subarray(4, length + 4).toString()) as { clientId: string; message: unknown }
      const socket = clients.get(clientId)
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
    } catch { return process.exit(1) }
    buffered = buffered.subarray(length + 4)
  }
})
process.stdin.on('end', () => process.exit(0))
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => process.exit(0))
process.on('exit', () => {
  try { if (JSON.parse(readFileSync(file, 'utf8')).token === token) unlinkSync(file) } catch { /* 连接文件可能已由新进程接管。 */ }
})

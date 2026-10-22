import { chmodSync, existsSync, mkdirSync, rmSync, appendFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { acquireProcessLock } from '../../process.js'
import { adminSocketPath, dataDir, lockPath, mode, socketPath } from './config.js'
import { Manager } from './manager.js'
import { parseRequest } from './protocol.js'
import { message } from './platform.js'

mkdirSync(dataDir, { recursive: true })
if (acquireProcessLock(lockPath)) process.exit(0)
for (const socket of [socketPath, adminSocketPath]) if (existsSync(socket)) rmSync(socket)
const manager = new Manager()
let stopping = false
function listen(endpoint: string, admin: boolean) {
  const server = createServer((socket) => {
    let input = '', handled = false
    socket.setEncoding('utf8')
    socket.setTimeout(31 * 60_000, () => socket.destroy())
    socket.on('error', () => {})
    socket.on('data', (chunk: string) => {
      if (handled) return
      input += chunk
      if (input.length > 64 * 1024) { socket.destroy(); return }
      if (!input.includes('\n')) return
      handled = true
      void (async () => {
        try {
          if (stopping) throw new Error('设备服务正在重启，请稍后重试')
          const request = parseRequest(JSON.parse(input.slice(0, input.indexOf('\n'))))
          if (!admin && (request.action === 'control' || request.action === 'stop' || (request.action === 'screenshot' && !('owner' in request && request.owner && request.lease)))) throw new Error('此操作仅限设备管理页面或管理服务')
          const result = await manager.handle(request)
          socket.end(JSON.stringify({ ok: true, result }) + '\n')
          if (request.action === 'stop') stopping = true
          if (request.action === 'stop') setTimeout(() => { server.close(); process.exit(0) }, 100)
        } catch (error) {
          socket.end(JSON.stringify({ ok: false, error: message(error) }) + '\n')
        }
      })()
    })
  })
  server.on('error', (error) => { console.error(error); process.exit(1) })
  server.listen(endpoint, () => {
    chmodSync(endpoint, 0o600)
    console.log(`Devices ${mode} 服务已启动：${socketPath}`)
    manager.tick()
  })
  return server
}
const servers = [listen(socketPath, false), listen(adminSocketPath, true)]
const timer = setInterval(() => {
  try { manager.tick() } catch (error) { appendFileSync(`${dataDir}/manager-errors.log`, `${new Date().toISOString()} ${message(error)}\n`) }
}, 5000)
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => {
  if (stopping) return
  stopping = true
  clearInterval(timer)
  for (const server of servers) server.close()
  void manager.shutdown().then(() => process.exit(0), (error) => { console.error(message(error)); process.exit(1) })
})

import { chmodSync, mkdirSync, rmSync } from 'node:fs'
import net from 'node:net'
import { acquireProcessLock } from '../../process.js'
import { dataDir, lockPath, socketPath } from './config.js'
import { Manager } from './manager.js'
import { parseRequest } from './protocol.js'
mkdirSync(dataDir, { recursive: true })
if (acquireProcessLock(lockPath)) process.exit(0)
rmSync(socketPath, { force: true })
const manager = new Manager()
let closing = false
const server = net.createServer((socket) => {
  let input = ''
  let handled = false
  socket.setEncoding('utf8'); socket.setTimeout(150_000, () => socket.destroy())
  socket.on('error', () => {})
  socket.on('data', (chunk) => {
    input += chunk
    if (input.length > 64 * 1024) { socket.destroy(); return }
    if (handled || !input.includes('\n')) return
    handled = true
    void (async () => {
      try {
        if (closing) throw new Error('构建服务正在更新')
        const request = parseRequest(JSON.parse(input.slice(0, input.indexOf('\n'))))
        const result = await manager.request(request)
        socket.end(JSON.stringify({ ok: true, result }) + '\n')
        if (request.action === 'stop' || request.action === 'handoff') { closing = true; setTimeout(() => process.exit(0), 100) }
      } catch (error) { socket.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }) + '\n') }
    })()
  })
})
server.listen(socketPath, () => chmodSync(socketPath, 0o600))
process.on('exit', () => rmSync(socketPath, { force: true }))
const tick = () => void manager.tick().catch(console.error)
tick(); setInterval(tick, 1000)
const poll = () => { if (manager.automatic()) void manager.poll().catch(console.error) }
poll(); setInterval(poll, 60_000)
// runner 是独立进程；服务退出不取消正在运行的构建，下一实例接续读取结果。
process.on('SIGTERM', () => process.exit(0))
process.on('SIGINT', () => process.exit(0))

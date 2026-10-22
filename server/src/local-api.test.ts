import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { chmodSync, existsSync, lstatSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { request } from 'node:http'
import path from 'node:path'
import { serve } from '@hono/node-server'
import { afterAll, describe, expect, it } from 'vitest'
import { localApiSocketPath } from './local-api-path.js'
import { startLocalApi } from './local-api.js'

const root = mkdtempSync('/tmp/binos-local-api-')
process.env.BINOS_ROOT = root
process.env.BINOS_TEST_INSTANCE = '0'
const { api, createApi } = await import('./api.js')
const { agentEnv } = await import('./services/kita/drivers/index.js')
const local = createApi(async (_c, next) => { await next() })
afterAll(() => rmSync(root, { recursive: true, force: true }))

function call(socketPath: string, url: string, body?: unknown) {
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = request({ agent: false, socketPath, path: url, method: body === undefined ? 'GET' : 'POST', headers: { host: 'localhost', 'Content-Type': 'application/json' } }, res => {
      let text = ''
      res.setEncoding('utf8')
      res.on('data', data => { text += data })
      res.on('end', () => resolve({ status: res.statusCode!, body: text }))
    })
    req.on('error', reject)
    req.end(body === undefined ? undefined : JSON.stringify(body))
  })
}
const close = (server: { close(callback: () => void): unknown }) => new Promise<void>(resolve => { server.close(resolve) })

describe('本机 API 入口', () => {
  it('socket 无需凭证且权限受限，TCP 保留认证，伪造本机请求头不能绕过', async () => {
    const socket = path.join(root, 'private', 'api.sock')
    const server = await startLocalApi(local.fetch, socket)
    const tcp = serve({ fetch: api.fetch, port: 0, hostname: '127.0.0.1' })
    await once(tcp, 'listening')
    try {
      expect(lstatSync(path.dirname(socket)).mode & 0o777).toBe(0o700)
      expect(lstatSync(socket).mode & 0o777).toBe(0o600)
      const response = await call(socket, '/api/apps/music')
      expect(response.status).toBe(200)
      expect(JSON.parse(response.body)).toMatchObject({ version: 1 })
      const port = (tcp.address() as { port: number }).port
      for (const headers of [{}, { 'x-binos-local': '1', 'x-forwarded-for': '127.0.0.1', 'x-real-ip': '127.0.0.1', host: 'localhost' }]) {
        expect((await fetch(`http://127.0.0.1:${port}/api/apps/music`, { headers })).status).toBe(401)
      }
      expect((await fetch(`http://127.0.0.1:${port}/api/health`)).status).toBe(200)
      expect((await call(socket, '/api/apps/music/queue', { id: 'clear-1', operation: { type: 'clear' } })).status).toBe(200)
      expect(JSON.parse((await call(socket, '/api/apps/music/queue')).body)).toMatchObject({ revision: 1, tracks: [] })
      expect((await call(socket, '/')).status).toBe(404)
    } finally {
      await Promise.all([close(server), close(tcp)])
    }
    expect(existsSync(socket)).toBe(false)
  })

  it('实例使用稳定且独立的短路径，并覆盖继承的 agent socket 配置', () => {
    const prod = localApiSocketPath(root)
    expect(localApiSocketPath(path.join(root, '.'))).toBe(prod)
    expect(localApiSocketPath(`${root}/preview`)).not.toBe(prod)
    expect(Buffer.byteLength(localApiSocketPath(`/tmp/${'a'.repeat(500)}`))).toBeLessThan(104)
    const inherited = process.env.BINOS_API_SOCKET
    process.env.BINOS_API_SOCKET = '/wrong-instance.sock'
    try {
      expect(agentEnv('codex').BINOS_API_SOCKET).toBe(prod)
      expect(agentEnv('claude').BINOS_API_SOCKET).toBe(prod)
    } finally {
      if (inherited === undefined) delete process.env.BINOS_API_SOCKET
      else process.env.BINOS_API_SOCKET = inherited
    }
  })

  it('拒绝覆盖活跃 socket、普通文件和符号链接目录', async () => {
    const active = path.join(root, 'active', 'api.sock')
    const server = await startLocalApi(local.fetch, active)
    try {
      await expect(startLocalApi(local.fetch, active)).rejects.toThrow('正在使用')
      expect((await call(active, '/api/health')).status).toBe(200)
    } finally { await close(server) }
    const file = path.join(root, 'file.sock')
    writeFileSync(file, 'keep')
    await expect(startLocalApi(local.fetch, file)).rejects.toThrow('不是当前用户的 socket')
    expect(lstatSync(file).isFile()).toBe(true)
    const target = path.join(root, 'target')
    mkdirSync(target)
    const link = path.join(root, 'link')
    symlinkSync(target, link)
    await expect(startLocalApi(local.fetch, path.join(link, 'api.sock'))).rejects.toThrow('不属于当前用户')
  })

  it('进程崩溃后接管失效 socket，正常关闭后可重新监听', async () => {
    const dir = path.join(root, 'stale')
    mkdirSync(dir)
    chmodSync(dir, 0o700)
    const socket = path.join(dir, 'api.sock')
    const child = spawn(process.execPath, ['--input-type=module', '-e', 'import {createServer} from "node:net"; createServer().listen(process.argv[1], () => console.log("ready"))', socket], { stdio: ['ignore', 'pipe', 'inherit'] })
    await once(child.stdout!, 'data')
    child.kill('SIGKILL')
    await once(child, 'exit')
    expect(lstatSync(socket).isSocket()).toBe(true)
    for (let i = 0; i < 2; i++) {
      const server = await startLocalApi(local.fetch, socket)
      expect((await call(socket, '/api/health')).status).toBe(200)
      await close(server)
      expect(existsSync(socket)).toBe(false)
    }
  })

  it('socket 支持流式响应，取消连接后执行端下线', async () => {
    const socket = path.join(root, 'stream', 'api.sock')
    const server = await startLocalApi(local.fetch, socket)
    try {
      const id = await new Promise<string>((resolve, reject) => {
        const req = request({ socketPath: socket, path: '/api/apps/music/players/connect?label=Local' }, res => {
          let text = ''
          res.on('data', data => {
            text += data.toString()
            const event = text.split('\n').find(line => line.startsWith('data:'))
            if (!event) return
            resolve(JSON.parse(event.slice(5)).playerId)
            res.destroy()
          })
        })
        req.on('error', reject)
        req.end()
      })
      expect(id).toBeTruthy()
      await expect.poll(async () => {
        const response = JSON.parse((await call(socket, '/api/apps/music/players')).body)
        return response.players.some((player: { id: string }) => player.id === id)
      }).toBe(false)
    } finally { await close(server) }
  })
})

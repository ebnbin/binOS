import { createAdaptorServer } from '@hono/node-server'
import type { ServerType } from '@hono/node-server'
import { chmodSync, lstatSync, mkdirSync, unlinkSync } from 'node:fs'
import type { Stats } from 'node:fs'
import { createConnection } from 'node:net'
import path from 'node:path'

function socketStat(file: string): Stats | undefined {
  try { return lstatSync(file) }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}

async function removeStaleSocket(file: string) {
  const stat = socketStat(file)
  if (!stat) return
  if (!stat.isSocket() || stat.uid !== process.getuid!()) throw new Error(`本机 API 路径不是当前用户的 socket：${file}`)
  await new Promise<void>((resolve, reject) => {
    const probe = createConnection(file)
    probe.setTimeout(1000, () => { probe.destroy(); reject(new Error(`本机 API socket 未响应：${file}`)) })
    probe.once('connect', () => { probe.destroy(); reject(new Error(`本机 API socket 正在使用：${file}`)) })
    probe.once('error', (error: NodeJS.ErrnoException) => {
      probe.destroy()
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOENT') resolve()
      else reject(error)
    })
  })
  const current = socketStat(file)
  if (!current) return
  if (current.ino !== stat.ino) throw new Error(`本机 API socket 在检查期间发生变化：${file}`)
  unlinkSync(file)
}

async function listenLocalApi(server: ServerType, socketPath: string): Promise<void> {
  const dir = path.dirname(socketPath)
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  const directory = lstatSync(dir)
  if (!directory.isDirectory() || directory.uid !== process.getuid!()) throw new Error(`本机 API 目录不属于当前用户：${dir}`)
  chmodSync(dir, 0o700)
  await removeStaleSocket(socketPath)
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(socketPath, () => {
      server.off('error', reject)
      try { chmodSync(socketPath, 0o600); resolve() }
      catch (error) { server.close(); reject(error) }
    })
  })
  const inode = lstatSync(socketPath).ino
  const cleanup = () => {
    if (socketStat(socketPath)?.ino === inode) unlinkSync(socketPath)
  }
  process.once('exit', cleanup)
  server.once('close', () => { process.off('exit', cleanup); cleanup() })
}

export async function startLocalApi(fetch: Parameters<typeof createAdaptorServer>[0]['fetch'], socketPath: string) {
  const server = createAdaptorServer({ fetch })
  await listenLocalApi(server, socketPath)
  return server
}

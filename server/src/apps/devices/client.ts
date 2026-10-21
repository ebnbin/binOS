import { spawn } from 'node:child_process'
import { createConnection } from 'node:net'
import { closeSync, mkdirSync, openSync } from 'node:fs'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { build, dataDir, mode, socketPath } from './config.js'
import type { Request, Snapshot } from './types.js'

function send<T>(request: Request): Promise<T> {
  return new Promise((resolve, reject) => {
    const socket = createConnection(socketPath)
    let output = ''
    socket.setEncoding('utf8')
    socket.setTimeout(request.action === 'run' ? request.timeout + 10_000 : 360_000, () => socket.destroy(new Error('设备服务响应超时')))
    socket.on('connect', () => socket.write(JSON.stringify(request) + '\n'))
    socket.on('error', reject)
    socket.on('end', () => {
      try {
        const reply = JSON.parse(output) as { ok: boolean; result: T; error?: string }
        if (!reply.ok) reject(new Error(reply.error ?? '设备操作失败'))
        else resolve(reply.result)
      } catch (error) { reject(error) }
    })
    socket.on('data', (chunk: string) => { output += chunk; if (output.length > 40 * 1024 * 1024) socket.destroy(new Error('设备服务响应过大')) })
  })
}
let starting: Promise<void> | undefined
async function ensure() {
  if (starting) return starting
  try {
    const status = await send<Snapshot>({ action: 'status' })
    if (status.mode !== mode) throw new Error('该数据目录已有不同模式的设备服务，请使用独立目录')
    if (status.build === build) return
    await send({ action: 'stop' })
    await sleep(200)
  } catch (error) {
    if (!['ENOENT', 'ECONNREFUSED'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error
  }
  starting ??= (async () => {
    mkdirSync(dataDir, { recursive: true })
    const log = openSync(path.join(dataDir, 'manager.log'), 'a', 0o600)
    try {
      const entry = path.join(import.meta.dirname, `daemon${path.extname(import.meta.filename)}`)
      const child = spawn(process.execPath, [...process.execArgv, entry], { env: process.env, stdio: ['ignore', log, log], detached: true })
      child.on('error', () => {})
      child.unref()
    } finally { closeSync(log) }
    for (let attempt = 0; attempt < 60; attempt++) {
      await sleep(100)
      try { await send({ action: 'status' }); return } catch { /* 等待 socket 开始监听。 */ }
    }
    throw new Error(`设备服务未能启动，请查看 ${path.join(dataDir, 'manager.log')}`)
  })().finally(() => { starting = undefined })
  return starting
}
export async function deviceRequest<T>(request: Request): Promise<T> {
  await ensure()
  return send<T>(request)
}

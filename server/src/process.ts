import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

// 进程号可能被系统重新分配给别的程序，加上启动时间才能确认是同一个进程
export type ProcessIdentity = {
  pid: number
  startedAt: string
}

export function processStartTime(pid: number): string | undefined {
  try {
    return execFileSync('ps', ['-o', 'lstart=', '-p', String(pid)], { encoding: 'utf8' }).trim() || undefined
  } catch {
    return undefined
  }
}

export function currentProcess(): ProcessIdentity {
  return { pid: process.pid, startedAt: processStartTime(process.pid)! }
}

export function isRunning(identity: ProcessIdentity): boolean {
  return processStartTime(identity.pid) === identity.startedAt
}

// 不调用 ps，开销小，适合频繁检查一个已经核对过身份的进程
export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

// 拿到锁返回 undefined，否则返回仍在运行的持有者；持有者没有正常退出时接管
export function acquireProcessLock(lockPath: string): ProcessIdentity | undefined {
  mkdirSync(path.dirname(lockPath), { recursive: true })
  const own = currentProcess()
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      writeFileSync(lockPath, JSON.stringify(own) + '\n', { flag: 'wx' })
      process.on('exit', () => {
        if (readLock(lockPath)?.pid === own.pid) {
          rmSync(lockPath, { force: true })
        }
      })
      return undefined
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw err
      }
    }
    const holder = readLock(lockPath)
    if (holder && isRunning(holder)) {
      return holder
    }
    rmSync(lockPath, { force: true })
  }
  throw new Error(`无法获取 ${lockPath}`)
}

function readLock(lockPath: string): ProcessIdentity | undefined {
  try {
    return JSON.parse(readFileSync(lockPath, 'utf8'))
  } catch {
    return undefined
  }
}

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { libraryDir } from './paths.js'
import { processStartTime } from './process.js'

// 一个根目录的数据只能由一个后端读写：两个后端会同时跟进同一轮回答，重复写入记录
const lockPath = path.join(libraryDir, 'server.lock')

type Lock = {
  pid: number
  startedAt: string
}

export function acquireRootLock() {
  mkdirSync(libraryDir, { recursive: true })
  const own: Lock = { pid: process.pid, startedAt: processStartTime(process.pid)! }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      writeFileSync(lockPath, JSON.stringify(own) + '\n', { flag: 'wx' })
      process.on('exit', () => {
        if (readLock()?.pid === own.pid) {
          rmSync(lockPath, { force: true })
        }
      })
      return
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw err
      }
    }
    const holder = readLock()
    if (holder && processStartTime(holder.pid) === holder.startedAt) {
      throw new Error(`根目录 ${path.dirname(libraryDir)} 已有后端在运行（进程 ${holder.pid}）`)
    }
    // 上一个后端没有正常退出，锁已经无效
    rmSync(lockPath, { force: true })
  }
  throw new Error(`无法获取 ${lockPath}`)
}

function readLock(): Lock | undefined {
  try {
    return JSON.parse(readFileSync(lockPath, 'utf8'))
  } catch {
    return undefined
  }
}

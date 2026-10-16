import { execFileSync } from 'node:child_process'

// 进程号可能被系统重新分配给别的程序，所以同时核对进程的启动时间，两者都对得上才是同一个进程
export function processStartTime(pid: number): string | undefined {
  try {
    return execFileSync('ps', ['-o', 'lstart=', '-p', String(pid)], { encoding: 'utf8' }).trim() || undefined
  } catch {
    return undefined
  }
}

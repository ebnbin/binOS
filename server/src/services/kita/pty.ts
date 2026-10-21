import { spawn } from 'node:child_process'
import type { ChildProcessWithoutNullStreams } from 'node:child_process'

// 在终端里跑交互式的命令（agent 的登录）：Node 没有伪终端，借系统自带的 python3 开一个，标准输入输出原样转发，退出码也传回来。
// 终端设得很宽，链接和令牌不会被折行打断；后端那头断了（标准输入读到结尾）就结束命令，不留下等输入的进程
const ptyScript = `
import fcntl, os, pty, select, signal, struct, sys, termios
pid, fd = pty.fork()
if pid == 0:
    os.execvp(sys.argv[1], sys.argv[1:])
fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack('HHHH', 50, 2000, 0, 0))
while True:
    ready, _, _ = select.select([fd, 0], [], [])
    if fd in ready:
        try:
            data = os.read(fd, 65536)
        except OSError:
            break
        if not data:
            break
        os.write(1, data)
    if 0 in ready:
        data = os.read(0, 65536)
        if not data:
            os.kill(pid, signal.SIGTERM)
            break
        os.write(fd, data)
sys.exit(os.waitstatus_to_exitcode(os.waitpid(pid, 0)[1]))
`

// output 是到目前为止的全部输出，exitCode 退出后才有（启动失败是 null）
export type Terminal = { child: ChildProcessWithoutNullStreams; output: string; exitCode?: number | null }

// 自己一个进程组，连同伪终端里的命令一起结束（见 killTerminal）
export function openTerminal(command: string[], env: NodeJS.ProcessEnv): Terminal {
  const child = spawn('/usr/bin/python3', ['-I', '-c', ptyScript, ...command], { env: { ...env, TERM: 'xterm-256color' }, detached: true })
  const terminal: Terminal = { child, output: '' }
  child.stdout.on('data', (data: Buffer) => (terminal.output += data.toString()))
  child.stderr.on('data', (data: Buffer) => (terminal.output += data.toString()))
  child.on('close', (code) => (terminal.exitCode = code))
  child.on('error', () => (terminal.exitCode = null))
  return terminal
}

export function killTerminal(terminal: Terminal) {
  if (terminal.exitCode === undefined) {
    try {
      process.kill(-terminal.child.pid!, 'SIGTERM')
    } catch {
      // 已经退出了
    }
  }
}

// 等输出里出现想要的东西；命令退出或超时时给 undefined
export async function waitFor<T>(terminal: Terminal, check: (output: string) => T | undefined, timeout: number): Promise<T | undefined> {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const found = check(terminal.output)
    if (found !== undefined) {
      return found
    }
    if (terminal.exitCode !== undefined) {
      return check(terminal.output)
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  return undefined
}

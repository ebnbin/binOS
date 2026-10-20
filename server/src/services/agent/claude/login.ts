import { spawn } from 'node:child_process'
import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { stripVTControlCharacters } from 'node:util'
import { agentEnv } from '../adapters.js'
import { publishAuth, storeToken } from './auth.js'

// 在网页上登录 Claude（见 auth.ts 的两份登录）：
// - login：重新完整登录，对 binOS 的 Claude 配置目录跑 `claude auth login`，它自己把登录存进钥匙串
// - token：生成备用的一年期 token，在一个空的配置目录里跑 `claude setup-token`（不碰现有的登录），把它给出的令牌存进钥匙串
// 两者都给出授权链接，用户在自己的浏览器里授权（哪台设备都行，授权后的页面直接显示代码），把代码贴回网页交给它。
// 这些命令是交互式的，要在终端里跑：Node 没有伪终端，借系统自带的 python3 开一个，标准输入输出原样转发，退出码也传回来。
// 终端设得很宽，链接和令牌不会被折行打断

export type LoginKind = 'login' | 'token'

// 后端那头断了（标准输入读到结尾）就结束 claude，不留下等输入的进程
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

type Login = {
  kind: LoginKind
  child: ChildProcessWithoutNullStreams
  output: string
  exitCode?: number | null
  // token 用的空配置目录，结束时删掉
  tempDir?: string
  finishing?: boolean
  timer: NodeJS.Timeout
}

const logins = new Map<string, Login>()

// 用户迟迟不贴代码，十分钟后放弃
const loginTimeout = 10 * 60_000

// 终端的控制序列（CSI），比如移动光标
const csi = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[A-Za-z]`, 'g')

// 去掉终端的控制序列只留文字。它的界面用移动光标把字隔开，移动光标换成空格，不然字会连在一起
const plain = (text: string) => stripVTControlCharacters(text.replace(csi, ' ')).replace(/[ \t]+/g, ' ')

const authorizeUrl = (output: string) => /https:\/\/\S+\/oauth\/authorize\?\S+/.exec(plain(output))?.[0]

// 成功时先打一行「Long-lived authentication token created successfully!」，下一行是令牌；后面跟着空白才算完整
const findToken = (text: string) => /created successfully!?\s+([\w-]{40,})\s/.exec(text)?.[1]

// 失败时它打出来的那句
const failure = /(?:OAuth error|Login failed|Invalid code|error)[^\n]*/i

// 出错时给用户看的：它最后说的几句
function lastWords(login: Login, from: number) {
  return plain(login.output.slice(from))
    .replace(/[✢✳✶✻✽·*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(-200)
}

function end(id: string) {
  const login = logins.get(id)
  if (!login) {
    return
  }
  logins.delete(id)
  clearTimeout(login.timer)
  if (login.exitCode === undefined) {
    try {
      process.kill(-login.child.pid!, 'SIGTERM')
    } catch {
      // 已经退出了
    }
  }
  if (login.tempDir) {
    rmSync(login.tempDir, { recursive: true, force: true })
  }
}

// 等输出里出现想要的东西；进程退出或超时时给 undefined
async function waitFor<T>(login: Login, check: (output: string) => T | undefined, timeout: number): Promise<T | undefined> {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const found = check(login.output)
    if (found !== undefined) {
      return found
    }
    if (login.exitCode !== undefined) {
      return check(login.output)
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  return undefined
}

// 开始登录：返回这次登录的编号和授权链接
export async function startLogin(kind: LoginKind): Promise<{ id: string; url: string }> {
  const id = randomUUID()
  const tempDir = kind === 'token' ? mkdtempSync(path.join(tmpdir(), 'binos-claude-token-')) : undefined
  const command = kind === 'login' ? ['claude', 'auth', 'login'] : ['claude', 'setup-token']
  // 不在这台 Mac 上打开浏览器，链接交给网页
  const env = { ...agentEnv('claude'), ...(tempDir && { CLAUDE_CONFIG_DIR: tempDir }), BROWSER: '/usr/bin/true', TERM: 'xterm-256color' }
  // 自己一个进程组，连同伪终端里的 claude 一起结束
  const child = spawn('/usr/bin/python3', ['-I', '-c', ptyScript, ...command], { env, detached: true })
  const login: Login = { kind, child, output: '', tempDir, timer: setTimeout(() => end(id), loginTimeout) }
  child.stdout.on('data', (data: Buffer) => (login.output += data.toString()))
  child.stderr.on('data', (data: Buffer) => (login.output += data.toString()))
  child.on('close', (code) => (login.exitCode = code))
  child.on('error', () => (login.exitCode = null))
  logins.set(id, login)
  const url = await waitFor(login, authorizeUrl, 30_000)
  if (!url) {
    const tail = lastWords(login, 0)
    end(id)
    throw new Error(`没拿到授权链接${tail ? `：${tail}` : ''}`)
  }
  return { id, url }
}

// 用户贴回授权后的代码，完成这次登录
export async function finishLogin(id: string, code: string): Promise<void> {
  const login = logins.get(id)
  if (!login) {
    throw new Error('这次登录已经失效，重新开始')
  }
  if (login.finishing) {
    throw new Error('正在处理，稍等')
  }
  login.finishing = true
  try {
    const from = login.output.length
    // 代码和回车分两次写：一次写进去的一长串会被当成粘贴，里面的回车也成了文字，不会提交
    login.child.stdin.write(code.trim())
    await new Promise((resolve) => setTimeout(resolve, 500))
    login.child.stdin.write('\r')
    if (login.kind === 'login') {
      // 登录由它自己存进钥匙串，成功了就正常退出
      const exited = await waitFor(login, () => (login.exitCode !== undefined ? true : undefined), 90_000)
      if (!exited || login.exitCode !== 0 || failure.test(plain(login.output.slice(from)))) {
        throw new Error(`登录没成功，claude 最后说：「${lastWords(login, from) || '（什么都没说）'}」。重新开始`)
      }
      publishAuth()
    } else {
      const result = await waitFor(
        login,
        (output) => {
          const text = plain(output.slice(from))
          const token = findToken(text)
          if (token) {
            return { token }
          }
          const error = failure.exec(text)?.[0]
          return error && (/Press Enter/i.test(text) || login.exitCode !== undefined) ? { error } : undefined
        },
        90_000,
      )
      if (!result || 'error' in result) {
        throw new Error(`没拿到令牌，claude 最后说：「${lastWords(login, from) || '（什么都没说）'}」。重新开始`)
      }
      storeToken(result.token)
    }
  } finally {
    end(id)
  }
}

export function cancelLogin(id: string) {
  end(id)
}

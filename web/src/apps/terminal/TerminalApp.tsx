import { AlertIcon, CheckIcon, CopyIcon, PlusIcon, SyncIcon, TerminalIcon, TrashIcon } from '@primer/octicons-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import type { TerminalSession } from '@binos/server/apps/terminal/types'
import type { WindowContext } from '../types.ts'
import { openTerminal, terminalRequest } from './transport.ts'
import type { TerminalTransport } from './transport.ts'
import '@xterm/xterm/css/xterm.css'
import { Alert } from '../../ui/Alert.tsx'
import { Blankslate } from '../../ui/Blankslate.tsx'
import { Button } from '../../ui/Button.tsx'
import { Spinner } from '../../ui/Spinner.tsx'
import underline from '../../ui/UnderlineNav.module.css'
import styles from './TerminalApp.module.css'

type Sessions = { available: boolean; sessions: TerminalSession[] }

export function TerminalApp({ ctx }: { ctx: WindowContext }) {
  const [snapshot, setSnapshot] = useState<Sessions>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmId, setConfirmId] = useState('')
  const confirm = confirmId === ctx.route.slice(1)
  const [copiedId, setCopiedId] = useState('')
  const copied = copiedId === ctx.route.slice(1)
  const id = ctx.route.slice(1)
  const session = snapshot?.sessions.find((item) => item.id === id)
  const { navigate, setTitle } = ctx
  const load = useCallback(async () => {
    try {
      setSnapshot(await terminalRequest<Sessions>('/'))
      setError('')
    } catch (e) {
      setError(String(e))
    }
  }, [])
  useEffect(() => {
    queueMicrotask(() => void load())
    const timer = setInterval(() => void load(), 5000)
    return () => clearInterval(timer)
  }, [load])
  useEffect(() => setTitle(session ? session.cwd : ''), [session, setTitle])
  const create = async () => {
    setBusy(true)
    try {
      const created = await terminalRequest<TerminalSession>('/sessions', 'POST')
      await load()
      navigate(`/${created.id}`)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }
  const end = async () => {
    setBusy(true)
    try {
      await terminalRequest(`/sessions/${id}`, 'DELETE')
      navigate('/')
      await load()
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
      setConfirmId('')
    }
  }
  return (
    <div className={styles.app}>
      <header className={styles.toolbar}>
        <h1>
          <TerminalIcon size={16} />
          宿主 Mac
        </h1>
        <div className={styles.actions}>
          {session && (
            <Button
              size="small"
              leadingVisual={copied ? CheckIcon : CopyIcon}
              title="复制 Mac Terminal 连接命令"
              onClick={() =>
                void navigator.clipboard
                  .writeText(session.command)
                  .then(() => setCopiedId(id))
                  .catch(() => setError('无法访问剪贴板，请复制下方连接命令'))
              }
            >
              <span className={styles.collapsible}>{copied ? '已复制' : '在 Mac 中连接'}</span>
            </Button>
          )}
          <Button size="small" leadingVisual={PlusIcon} disabled={busy || !snapshot?.available} onClick={() => void create()}>
            新建终端
          </Button>
        </div>
      </header>
      {error && <Alert className={styles.error}>{error}</Alert>}
      {!!snapshot?.sessions.length && (
        <nav className={`${underline.nav} ${styles.tabs}`} aria-label="终端会话">
          {snapshot.sessions.map((item, index) => (
            <button key={item.id} type="button" className={underline.tab} aria-current={item.id === id ? 'page' : undefined} onClick={() => navigate(`/${item.id}`)} title={item.cwd}>
              <span className={underline.icon}><TerminalIcon size={16} /></span>
              终端 {index + 1}
            </button>
          ))}
        </nav>
      )}
      {session ? (
        <>
          <TerminalPane key={session.id} id={session.id} onExit={load} />
          <footer className={styles.footer}>
            <span title={session.cwd}>{session.cwd}</span>
            <Button size="small" variant="danger" leadingVisual={TrashIcon} aria-expanded={confirm} onClick={() => setConfirmId(confirm ? '' : id)}>
              结束会话
            </Button>
          </footer>
          <details className={styles.connection}>
            <summary>Mac Terminal 连接命令</summary>
            <code>{session.command}</code>
            <p>两边共享同一个 shell。关闭窗口后继续运行；滚轮查看历史，按住 Shift 可选择文字。</p>
          </details>
          {confirm && (
            <div className={styles.confirm} role="alert">
              <span className={styles.confirmIcon}><AlertIcon size={16} /></span>
              <span className={styles.confirmText}>结束这个终端及其中正在运行的程序？</span>
              <div className={styles.confirmActions}>
                <Button size="small" onClick={() => setConfirmId('')}>取消</Button>
                <Button size="small" variant="danger" disabled={busy} onClick={() => void end()}>
                  结束会话
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className={styles.empty}>
          <Blankslate
            icon={snapshot ? TerminalIcon : undefined}
            visual={snapshot ? undefined : <Spinner size="medium" />}
            heading={!snapshot ? '正在连接宿主 Mac…' : !snapshot.available ? '需要安装 tmux' : id ? '这个终端已结束' : 'Mac 的命令行，在 binOS 中使用'}
            description={snapshot && (snapshot.available ? '在宿主 Mac 上运行命令。关闭窗口或断线后，会话仍会继续。' : <>请在 Mac Terminal 中运行 <code>brew install tmux</code>，然后重启 binOS 后端。</>)}
            actions={snapshot?.available && (
              <Button variant="primary" leadingVisual={PlusIcon} disabled={busy} onClick={() => void create()}>
                新建终端
              </Button>
            )}
          />
        </div>
      )}
    </div>
  )
}

function TerminalPane({ id, onExit }: { id: string; onExit(): Promise<void> }) {
  const host = useRef<HTMLDivElement>(null)
  const [state, setState] = useState('正在连接…')
  const [attempt, setAttempt] = useState(0)
  const [ended, setEnded] = useState(false)
  const sendInput = useRef<(data: string) => void>(() => {})
  useEffect(() => {
    const element = host.current!
    // 终端外层固定为 Primer 暗色主题，配色直接取它的 ANSI token
    const style = getComputedStyle(element)
    const token = (name: string) => style.getPropertyValue(name).trim()
    const ansi = (name: string) => ({ [name]: token(`--ansi-${name}`), [`bright${name[0].toUpperCase()}${name.slice(1)}`]: token(`--ansi-${name}Bright`) })
    const text = token('--fgColor-default')
    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: token('--fontStack-monospace'),
      fontSize: 13,
      lineHeight: 1.25,
      scrollback: 10000,
      theme: {
        background: token('--bgColor-default'),
        foreground: text,
        cursor: token('--fgColor-accent'),
        cursorAccent: token('--bgColor-default'),
        selectionBackground: token('--selection-bgColor'),
        ...['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'].reduce((colors, name) => ({ ...colors, ...ansi(name) }), {}),
      },
      allowProposedApi: false,
    })
    const fit = new FitAddon()
    terminal.loadAddon(fit)
    terminal.open(element)
    let disposed = false
    let retry: ReturnType<typeof setTimeout> | undefined
    let transport: TerminalTransport | undefined
    let ready = false
    let exited = false
    let generation = 0
    let ack = 0
    let ackTimer: ReturnType<typeof setTimeout> | undefined
    const acknowledge = () => {
      clearTimeout(ackTimer)
      if (ack && ready) {
        transport?.send({ type: 'ack', size: ack })
        ack = 0
      }
    }
    const resize = () => {
      if (!element.clientWidth || !element.clientHeight) return
      fit.fit()
      if (ready) transport?.send({ type: 'resize', cols: Math.min(500, Math.max(2, terminal.cols)), rows: Math.min(200, Math.max(1, terminal.rows)) })
    }
    const connect = () => {
      if (disposed) return
      ready = false
      const current = ++generation
      setState('正在连接…')
      transport = openTerminal(
        id,
        (message) => {
          if (disposed || current !== generation) return
          if (message.type === 'ready') {
            terminal.reset()
            ack = 0
            ready = true
            setEnded(false)
            setState('已连接')
            resize()
            terminal.focus()
          } else if (message.type === 'output' && message.data) {
            const size = message.data.length
            terminal.write(message.data, () => {
              if (!ready || disposed || current !== generation) return
              ack += size
              if (ack >= 32768) acknowledge()
              else {
                clearTimeout(ackTimer)
                ackTimer = setTimeout(acknowledge, 20)
              }
            })
          } else if (message.type === 'ping') transport?.send({ type: 'ping' })
          else if (message.type === 'error') {
            setState(message.message ?? '连接失败')
            exited = true
            setEnded(true)
          } else if (message.type === 'exit') {
            exited = true
            ready = false
            setState('连接已结束')
            setEnded(true)
            void onExit()
          }
        },
        () => {
          ready = false
          clearTimeout(ackTimer)
          if (!disposed && !exited) {
            setState('连接断开，正在重连…')
            retry = setTimeout(connect, 2000)
          }
        },
      )
    }
    const input = (data: string) => {
      if (!ready) return
      for (let i = 0; i < data.length; i += 8192) transport?.send({ type: 'input', data: data.slice(i, i + 8192) })
    }
    sendInput.current = input
    const inputSubscription = terminal.onData(input)
    // tmux 的鼠标协议可能通过 xterm 的二进制输入事件发送。
    const binary = terminal.onBinary((data) => input(data))
    terminal.attachCustomKeyEventHandler((event) => !(event.metaKey && ['c', 'v', 'a', 'w', 't'].includes(event.key.toLowerCase())))
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    resize()
    connect()
    return () => {
      disposed = true
      ready = false
      clearTimeout(retry)
      clearTimeout(ackTimer)
      observer.disconnect()
      transport?.close()
      inputSubscription.dispose()
      binary.dispose()
      terminal.dispose()
    }
  }, [id, onExit, attempt])
  return (
    <div className={styles.pane} data-color-mode="dark" data-dark-theme="dark">
      <div className={styles.status}>
        <span className={styles.dot} data-connected={state === '已连接'} data-ended={ended} />
        {state}
        {ended && (
          <Button size="small" leadingVisual={SyncIcon} className={styles.reconnect} onClick={() => setAttempt((value) => value + 1)}>
            重新连接
          </Button>
        )}
      </div>
      <div className={styles.terminal} ref={host} />
      <div className={styles.keys} aria-label="终端快捷键">
        {[
          ['Esc', '\x1b'],
          ['Tab', '\t'],
          ['Ctrl+C', '\x03'],
          ['Ctrl+D', '\x04'],
          ['↑', '\x1b[A'],
          ['↓', '\x1b[B'],
          ['←', '\x1b[D'],
          ['→', '\x1b[C'],
        ].map(([label, data]) => (
          <Button key={label} size="small" onPointerDown={(event) => event.preventDefault()} onClick={() => sendInput.current(data)}>
            <kbd>{label}</kbd>
          </Button>
        ))}
      </div>
    </div>
  )
}

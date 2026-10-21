import {
  Button,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogTitle,
  MessageBar,
  MessageBarBody,
  Tab,
  TabList,
} from '@fluentui/react-components'
import { ModalHost } from '../../shell/hosts/ModalHost.tsx'
import { useTheme } from '../../ui/useTheme.ts'

import {
  AddRegular as Plus,
  ArrowClockwiseRegular as RefreshCw,
  CheckmarkRegular as Check,
  CopyRegular as Copy,
  DismissRegular as X,
  WindowConsoleRegular as TerminalIcon,
} from '@fluentui/react-icons'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import type { TerminalSession } from '@binos/server/apps/terminal/types'
import type { WindowContext } from '../types.ts'
import { openTerminal, terminalRequest } from './transport.ts'
import type { TerminalTransport } from './transport.ts'
import '@xterm/xterm/css/xterm.css'
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
        <strong>
          <TerminalIcon fontSize={17} />
          宿主 Mac
        </strong>
        <div className={styles.actions}>
          {session && (
            <Button
              type="submit"
              size="small"
              appearance="subtle"
              title="复制 Mac Terminal 连接命令"
              onClick={() =>
                void navigator.clipboard
                  .writeText(session.command)
                  .then(() => setCopiedId(id))
                  .catch(() => setError('无法访问剪贴板，请复制下方连接命令'))
              }
            >
              {copied ? <Check fontSize={15} /> : <Copy fontSize={15} />}
              <span>{copied ? '已复制' : '在 Mac 中连接'}</span>
            </Button>
          )}
          <Button type="submit" size="small" appearance="subtle" disabled={busy || !snapshot?.available} onClick={() => void create()}>
            <Plus fontSize={16} />
            新建终端
          </Button>
        </div>
      </header>
      {error && (
        <MessageBar intent="error" className={styles.error} role="alert">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}
      {!!snapshot?.sessions.length && (
        <TabList className={styles.tabs} aria-label="终端会话" selectedValue={id} onTabSelect={(_, data) => navigate(`/${data.value}`)}>
          {snapshot.sessions.map((item, index) => (
            <Tab key={item.id} value={item.id} icon={<TerminalIcon />} title={item.cwd}>
              终端 {index + 1}
            </Tab>
          ))}
        </TabList>
      )}
      {session ? (
        <>
          <TerminalPane key={session.id} id={session.id} onExit={load} />
          <footer className={styles.footer}>
            <span title={session.cwd}>{session.cwd}</span>
            <Button type="submit" size="small" appearance="subtle" onClick={() => setConfirmId(confirm ? '' : id)}>
              <X fontSize={14} />
              结束会话
            </Button>
          </footer>
          <details className={styles.connection}>
            <summary>Mac Terminal 连接命令</summary>
            <code>{session.command}</code>
            <p>两边共享同一个 shell。关闭窗口后继续运行；滚轮查看历史，按住 Shift 可选择文字。</p>
          </details>
          {confirm && (
            <ModalHost label="结束终端会话" dismissible={!busy} onClose={() => setConfirmId('')}>
              <DialogBody>
                <DialogTitle>结束终端会话？</DialogTitle>
                <DialogContent>结束这个终端及其中正在运行的程序？</DialogContent>
                <DialogActions>
                  <Button appearance="secondary" disabled={busy} onClick={() => setConfirmId('')}>
                    取消
                  </Button>
                  <Button appearance="primary" disabled={busy} onClick={() => void end()}>
                    结束会话
                  </Button>
                </DialogActions>
              </DialogBody>
            </ModalHost>
          )}
        </>
      ) : (
        <div className={styles.empty}>
          <TerminalIcon fontSize={36} />
          <h2>
            {!snapshot
              ? '正在连接宿主 Mac…'
              : !snapshot.available
                ? '需要安装 tmux'
                : id
                  ? '这个终端已结束'
                  : 'Mac 的命令行，在 binOS 中使用'}
          </h2>
          {snapshot &&
            (snapshot.available ? (
              <>
                <p>在宿主 Mac 上运行命令。关闭窗口或断线后，会话仍会继续。</p>
                <Button type="submit" size="small" appearance="subtle" disabled={busy} onClick={() => void create()}>
                  <Plus fontSize={16} />
                  新建终端
                </Button>
              </>
            ) : (
              <p>
                请在 Mac Terminal 中运行 <code>brew install tmux</code>，然后重启 binOS 后端。
              </p>
            ))}
        </div>
      )}
    </div>
  )
}

function TerminalPane({ id, onExit }: { id: string; onExit(): Promise<void> }) {
  const theme = useTheme()
  const terminalRef = useRef<Terminal | null>(null)
  const host = useRef<HTMLDivElement>(null)
  const [state, setState] = useState('正在连接…')
  const [attempt, setAttempt] = useState(0)
  const [ended, setEnded] = useState(false)
  const sendInput = useRef<(data: string) => void>(() => {})
  useEffect(() => {
    const element = host.current!
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      scrollback: 10000,
      allowProposedApi: false,
    })
    terminalRef.current = terminal
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
      if (ready)
        transport?.send({
          type: 'resize',
          cols: Math.min(500, Math.max(2, terminal.cols)),
          rows: Math.min(200, Math.max(1, terminal.rows)),
        })
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
      terminalRef.current = null
      terminal.dispose()
    }
  }, [id, onExit, attempt])
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.options.fontFamily = theme.fontFamilyMonospace
      terminalRef.current.options.theme = {
        background: theme.colorNeutralBackground1,
        foreground: theme.colorNeutralForeground1,
        cursor: theme.colorBrandForeground1,
        selectionBackground: theme.colorNeutralBackground1Selected,
      }
    }
  }, [theme, id, attempt])

  return (
    <div className={styles.pane}>
      <div className={styles.status}>
        <span data-connected={state === '已连接'} />
        {state}
        {ended && (
          <Button type="submit" size="small" appearance="subtle" onClick={() => setAttempt((value) => value + 1)}>
            <RefreshCw fontSize={13} />
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
          <Button
            type="submit"
            size="small"
            appearance="subtle"
            key={label}
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => sendInput.current(data)}
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
  )
}

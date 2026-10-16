import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import './App.css'

// 与后端 transcript.jsonl 的条目一致
type Entry = {
  type: 'user' | 'assistant' | 'system'
  uuid: string
  message?: { role: string; content: string | { type: string; text?: string }[] }
  content?: string
}

type LiveEvent =
  | { type: 'entry'; index: number; entry: Entry }
  | { type: 'partial'; text: string }
  | { type: 'status'; running: boolean }

// 触屏设备上回车换行，用按钮发送；有键盘的设备上回车发送，Shift+回车换行
const enterSends = !window.matchMedia('(pointer: coarse)').matches

function App() {
  // undefined：还在读取；null：新对话，还没有 session
  const [sessionId, setSessionId] = useState<number | null | undefined>(undefined)
  const [entries, setEntries] = useState<Entry[]>([])
  const [running, setRunning] = useState(false)
  const [partial, setPartial] = useState('')
  const [notice, setNotice] = useState('')
  const [input, setInput] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  // 打开页面时进入最近的 session
  useEffect(() => {
    fetch('/api/sessions')
      .then((res) => res.json())
      .then(({ ids }) => setSessionId(ids[0] ?? null))
      .catch(() => setSessionId(null))
  }, [])

  function newSession() {
    setSessionId(null)
    setEntries([])
    setPartial('')
    setNotice('')
  }

  // 连上当前 session 的实时推送，断开后从已有的条数接着连
  useEffect(() => {
    if (sessionId == null) {
      return
    }
    let count = 0
    let source: EventSource | undefined
    let retry: number | undefined
    const connect = () => {
      source = new EventSource(`/api/sessions/${sessionId}/stream?from=${count}`)
      source.onmessage = (message) => {
        const event: LiveEvent = JSON.parse(message.data)
        if (event.type === 'entry') {
          if (event.index === count) {
            count += 1
            setEntries((prev) => [...prev, event.entry])
          }
        } else if (event.type === 'partial') {
          setPartial(event.text)
        } else {
          setRunning(event.running)
          if (!event.running) {
            setPartial('')
          }
        }
      }
      source.onerror = () => {
        source?.close()
        retry = window.setTimeout(connect, 3000)
      }
    }
    connect()
    return () => {
      source?.close()
      window.clearTimeout(retry)
    }
  }, [sessionId])

  useEffect(() => {
    const list = listRef.current
    list?.scrollTo({ top: list.scrollHeight, behavior: 'smooth' })
  }, [entries, partial, running])

  async function send() {
    const text = input.trim()
    if (!text || running || sessionId === undefined) {
      return
    }
    setNotice('')
    const url = sessionId === null ? '/api/sessions' : `/api/sessions/${sessionId}/messages`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }).catch(() => undefined)
    if (!res?.ok) {
      setNotice(res?.status === 409 ? 'agent 正在处理另一条消息' : `发送失败（${res?.status ?? '网络错误'}）`)
      return
    }
    setInput('')
    const { id } = await res.json()
    setSessionId(id)
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (enterSends && event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      send()
    }
  }

  return (
    <div className="app">
      <header className="header">
        <span>binOS</span>
        <button type="button" onClick={newSession} disabled={running || !sessionId}>
          新对话
        </button>
      </header>
      <div className="messages" ref={listRef}>
        {entries.length === 0 && !running && (
          <p className="empty">对 binOS 的 agent 说点什么</p>
        )}
        {entries.map((entry) => (
          <div key={entry.uuid} className={`message ${entry.type}`}>
            {entryText(entry)}
          </div>
        ))}
        {running && <div className="message assistant pending">{partial || '正在处理…'}</div>}
        {notice && <div className="message system">{notice}</div>}
      </div>
      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault()
          send()
        }}
      >
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="输入消息"
          rows={1}
          disabled={running}
        />
        <button type="submit" disabled={running || !input.trim()}>
          发送
        </button>
      </form>
    </div>
  )
}

function entryText(entry: Entry): string {
  if (entry.type === 'system') {
    return entry.content ?? ''
  }
  const content = entry.message?.content
  if (typeof content === 'string') {
    return content
  }
  const text = (content ?? []).map((block) => block.text ?? '').filter(Boolean).join('\n\n')
  return text || '（没有文字回复）'
}

export default App

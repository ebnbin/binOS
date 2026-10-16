import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import './App.css'

type Message = { role: 'user' | 'agent' | 'error'; text: string }

type Task =
  | { status: 'running' }
  | { status: 'done'; reply: string }
  | { status: 'failed'; error: string }

// 触屏设备上回车换行，用按钮发送；有键盘的设备上回车发送，Shift+回车换行
const enterSends = !window.matchMedia('(pointer: coarse)').matches

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [waiting, setWaiting] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const list = listRef.current
    list?.scrollTo({ top: list.scrollHeight, behavior: 'smooth' })
  }, [messages, waiting])

  const append = (message: Message) => setMessages((prev) => [...prev, message])

  async function send() {
    const text = input.trim()
    if (!text || waiting) {
      return
    }
    setInput('')
    append({ role: 'user', text })
    setWaiting(true)
    try {
      append({ role: 'agent', text: await ask(text) })
    } catch (err) {
      append({ role: 'error', text: (err as Error).message })
    } finally {
      setWaiting(false)
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (enterSends && event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      send()
    }
  }

  return (
    <div className="app">
      <header className="header">binOS</header>
      <div className="messages" ref={listRef}>
        {messages.length === 0 && !waiting && (
          <p className="empty">对 binOS 的 agent 说点什么</p>
        )}
        {messages.map((message, index) => (
          <div key={index} className={`message ${message.role}`}>
            {message.text}
          </div>
        ))}
        {waiting && <div className="message agent pending">正在处理…</div>}
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
          disabled={waiting}
        />
        <button type="submit" disabled={waiting || !input.trim()}>
          发送
        </button>
      </form>
    </div>
  )
}

// 提交给 agent 后轮询结果：agent 可能运行好几分钟，不能让一个请求一直等着
async function ask(message: string): Promise<string> {
  const res = await fetch('/api/agent/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
  if (res.status === 409) {
    throw new Error('agent 正在处理另一条消息')
  }
  if (!res.ok) {
    throw new Error(`发送失败（${res.status}）`)
  }
  const { id } = await res.json()

  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 2000))
    // 网络暂时不通或后端暂时不可用时继续等
    const res = await fetch(`/api/agent/tasks/${id}`).catch(() => undefined)
    if (res?.status === 404) {
      throw new Error('任务丢失了，后端可能重启过')
    }
    if (!res?.ok) {
      continue
    }
    const task: Task = await res.json()
    if (task.status === 'done') {
      return task.reply
    }
    if (task.status === 'failed') {
      throw new Error(task.error)
    }
  }
}

export default App

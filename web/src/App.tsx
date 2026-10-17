import { useEffect, useState } from 'react'
import './App.css'
import { listSessions } from './api.ts'
import { Conversation } from './components/Conversation.tsx'
import { Header } from './components/Header.tsx'
import { SessionList } from './components/SessionList.tsx'

export function App() {
  // undefined：还在读取；null：新对话，还没有 session
  const [sessionId, setSessionId] = useState<number | null | undefined>(undefined)
  const [showList, setShowList] = useState(false)

  // 打开页面时进入最近的 session
  useEffect(() => {
    listSessions()
      .then((sessions) => setSessionId(sessions[0]?.id ?? null))
      .catch(() => setSessionId(null))
  }, [])

  // 切换到另一个 session，null 为新对话
  function openSession(id: number | null) {
    setShowList(false)
    setSessionId(id)
  }

  return (
    <div className="app">
      <Header
        showList={showList}
        onToggleList={() => setShowList(!showList)}
        onNew={() => openSession(null)}
        canStartNew={showList || sessionId != null}
      />
      {showList && (
        <div className="messages">
          <SessionList current={sessionId ?? null} onSelect={openSession} />
        </div>
      )}
      {/* 看列表时对话只是隐藏，输入到一半的内容和实时推送的连接都保留；换 session 时重新挂载，对话的状态随之清空 */}
      {sessionId !== undefined && (
        <div className="conversation" hidden={showList}>
          <Conversation key={sessionId ?? 'new'} sessionId={sessionId} onCreated={setSessionId} />
        </div>
      )}
    </div>
  )
}

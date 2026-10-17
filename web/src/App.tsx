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

  useEffect(() => {
    listSessions()
      .then((sessions) => setSessionId(sessions[0]?.id ?? null))
      .catch(() => setSessionId(null))
  }, [])

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
      {/* 看列表时只隐藏对话，保留输入到一半的内容和实时推送的连接；换 session 时靠 key 重新挂载 */}
      {sessionId !== undefined && (
        <div className="conversation" hidden={showList}>
          <Conversation key={sessionId ?? 'new'} sessionId={sessionId} onCreated={setSessionId} />
        </div>
      )}
    </div>
  )
}

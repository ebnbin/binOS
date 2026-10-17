import { useEffect, useState } from 'react'
import styles from './App.module.css'
import { ConnectionStatus } from './components/ConnectionStatus.tsx'
import { Conversation } from './components/Conversation.tsx'
import { SessionList } from './components/SessionList.tsx'
import { TopBar } from './components/TopBar.tsx'
import { Link } from './components/ui/Link.tsx'
import { navigate, sessionPath, useRoute } from './router.ts'
import { useSessions } from './useSessions.ts'

export function App() {
  const route = useRoute()
  const { sessions, failed } = useSessions()
  // 刚建好的 session 可能还没出现在列表里，不能当成不存在
  const [createdId, setCreatedId] = useState<number | null>(null)

  const sessionId = route.name === 'session' ? route.id : null
  const session = sessions?.find((item) => item.id === sessionId)
  const missing = sessionId !== null && sessions !== undefined && !session && sessionId !== createdId
  const title = missing ? '对话不存在' : (session?.title ?? '')

  useEffect(() => {
    document.title = title ? `${title} - binOS` : 'binOS'
  }, [title])

  return (
    // 一列时首页只显示列表，其余页面只显示对话；两列时首页的右边是新对话
    <div className={styles.shell} data-view={route.name === 'home' ? 'list' : 'conversation'}>
      <div className={styles.listPane}>
        <SessionList sessions={sessions} failed={failed} current={sessionId} />
      </div>
      <main className={styles.conversationPane}>
        <TopBar title={title} sessionId={sessionId} />
        {missing ? (
          <div className={styles.missing}>
            <p>这个对话不存在</p>
            <Link to="/">返回对话列表</Link>
          </div>
        ) : (
          <Conversation
            key={sessionId ?? 'new'}
            sessionId={sessionId}
            onCreated={(id) => {
              setCreatedId(id)
              navigate(sessionPath(id), { replace: true })
            }}
          />
        )}
      </main>
      <ConnectionStatus />
    </div>
  )
}

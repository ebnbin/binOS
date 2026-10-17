import { useCallback, useState } from 'react'
import styles from './App.module.css'
import { Conversation } from './components/Conversation.tsx'
import { Sidebar } from './components/Sidebar.tsx'
import { TopBar } from './components/TopBar.tsx'
import { useSessions } from './useSessions.ts'

export function App() {
  const { sessions, failed, refresh } = useSessions()
  // undefined：还在读取；null：新对话，还没有 session
  const [sessionId, setSessionId] = useState<number | null | undefined>(undefined)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // 列表第一次读到时打开最近的 session
  if (sessionId === undefined && (sessions || failed)) {
    setSessionId(sessions?.[0]?.id ?? null)
  }

  function openSession(id: number | null) {
    setDrawerOpen(false)
    setSessionId(id)
  }

  const closeDrawer = useCallback(() => setDrawerOpen(false), [])
  const title = sessions?.find((session) => session.id === sessionId)?.title ?? ''

  return (
    <div className={styles.shell}>
      <Sidebar
        sessions={sessions}
        failed={failed}
        current={sessionId}
        open={drawerOpen}
        onSelect={openSession}
        onNew={() => openSession(null)}
        onClose={closeDrawer}
      />
      <main className={styles.main}>
        <TopBar title={title} sessionId={sessionId} onMenu={() => setDrawerOpen(true)} onNew={() => openSession(null)} />
        {sessionId !== undefined && (
          <Conversation
            key={sessionId ?? 'new'}
            sessionId={sessionId}
            onCreated={(id) => {
              setSessionId(id)
              refresh()
            }}
            onRunningChange={refresh}
          />
        )}
      </main>
    </div>
  )
}

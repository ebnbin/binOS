import { useEffect, useState } from 'react'
import type { AppContext } from '../types.ts'
import styles from './KitaApp.module.css'
import { Conversation } from './components/Conversation.tsx'
import { SessionList } from './components/SessionList.tsx'
import { TopBar } from './components/TopBar.tsx'
import { useSessions } from './useSessions.ts'

// /：对话列表；/new：新对话；/:id：某个对话
type Route = { name: 'home' } | { name: 'new' } | { name: 'session'; id: number }

function parseRoute(route: string): Route {
  if (route === '/new') {
    return { name: 'new' }
  }
  const match = /^\/(\d+)$/.exec(route)
  return match ? { name: 'session', id: Number(match[1]) } : { name: 'home' }
}

const sessionRoute = (id: number) => `/${id}`

export function KitaApp({ ctx }: { ctx: AppContext }) {
  const route = parseRoute(ctx.route)
  const { sessions, failed } = useSessions()
  // 刚建好的 session 可能还没出现在列表里，不能当成不存在
  const [createdId, setCreatedId] = useState<number | null>(null)

  const sessionId = route.name === 'session' ? route.id : null
  const session = sessions?.find((item) => item.id === sessionId)
  const missing = sessionId !== null && sessions !== undefined && !session && sessionId !== createdId
  const title = missing ? '对话不存在' : (session?.title ?? '')

  const { setTitle } = ctx
  useEffect(() => setTitle(title), [setTitle, title])

  return (
    <div className={styles.app}>
      {/* 一列时首页只显示列表，其余页面只显示对话；两列时首页的右边是新对话 */}
      <div className={styles.layout} data-view={route.name === 'home' ? 'list' : 'conversation'}>
        <div className={styles.listPane}>
          <SessionList sessions={sessions} failed={failed} current={sessionId} onNavigate={ctx.navigate} />
        </div>
        <main className={styles.conversationPane}>
          <TopBar
            title={title}
            sessionId={sessionId}
            context={session?.context}
            prs={session?.prs ?? []}
            onBack={ctx.back}
            onNew={() => ctx.navigate('/new')}
          />
          {missing ? (
            <div className={styles.missing}>
              <p>这个对话不存在</p>
              <button type="button" onClick={() => ctx.navigate('/')}>
                返回对话列表
              </button>
            </div>
          ) : (
            <Conversation
              key={sessionId ?? 'new'}
              sessionId={sessionId}
              session={session}
              onCreated={(id) => {
                setCreatedId(id)
                ctx.navigate(sessionRoute(id), { replace: true })
              }}
            />
          )}
        </main>
      </div>
    </div>
  )
}

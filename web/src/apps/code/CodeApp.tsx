import { Button } from '@fluentui/react-components'
import { useEffect, useRef, useState } from 'react'
import type { WindowContext } from '../types.ts'
import styles from './CodeApp.module.css'
import { Conversation } from './components/Conversation.tsx'
import { SessionList } from './components/SessionList.tsx'
import { TopBar } from './components/TopBar.tsx'
import { useSessions } from './useSessions.ts'

// /：对话列表；/new：新对话；/:id：某个对话
type Route = { name: 'home' } | { name: 'new'; project?: string } | { name: 'session'; id: number; item?: number }

function parseRoute(route: string): Route {
  if (route.split('?')[0] === '/new') {
    return { name: 'new', project: new URLSearchParams(route.split('?')[1]).get('project') ?? undefined }
  }
  const match = /^\/(\d+)(?:\?item=(\d+))?$/.exec(route)
  return match ? { name: 'session', id: Number(match[1]), ...(match[2] !== undefined && { item: Number(match[2]) }) } : { name: 'home' }
}

const sessionRoute = (id: number) => `/${id}`

export function CodeApp({ ctx }: { ctx: WindowContext }) {
  const route = parseRoute(ctx.route)
  const { sessions, projects, failed } = useSessions()
  // 刚建好的 session 可能还没出现在列表里，不能当成不存在
  const [created, setCreated] = useState<{ id: number; thread: string; project: string }>()
  const conversationScroll = useRef<HTMLDivElement>(null)

  const sessionId = route.name === 'session' ? route.id : null
  const session = sessions?.find((item) => item.id === sessionId)
  const project =
    session?.project ??
    (sessionId === created?.id ? created.project : undefined) ??
    (route.name === 'new' ? route.project : undefined) ??
    'binos'
  const missing = sessionId !== null && sessions !== undefined && !session && sessionId !== created?.id
  const title = missing ? '对话不存在' : (session?.title ?? '')

  const { setTitle } = ctx
  useEffect(() => setTitle(title), [setTitle, title])

  return (
    <div className={styles.app}>
      {/* 一列时首页只显示列表，其余页面只显示对话；两列时首页的右边是新对话 */}
      <div className={styles.layout} data-view={route.name === 'home' ? 'list' : 'conversation'}>
        <div className={styles.listPane}>
          <SessionList projects={projects} sessions={sessions} failed={failed} current={sessionId} onNavigate={ctx.navigate} />
        </div>
        <main className={styles.conversationPane}>
          <TopBar
            title={title}
            sessionId={sessionId}
            session={session}
            onBack={ctx.back}
            onNew={() => ctx.navigate(`/new?project=${encodeURIComponent(project)}`)}
            onScrollTop={() => conversationScroll.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          />
          {missing ? (
            <div className={styles.missing}>
              <p>这个对话不存在</p>
              <Button size="small" appearance="subtle" type="button" onClick={() => ctx.navigate('/')}>
                返回对话列表
              </Button>
            </div>
          ) : (
            <Conversation
              project={project}
              projects={projects}
              onProject={(id) => ctx.navigate(`/new?project=${encodeURIComponent(id)}`, { replace: true })}
              key={`${sessionId ?? 'new'}-${project}-${route.name === 'session' ? (route.item ?? '') : ''}`}
              targetItem={route.name === 'session' ? route.item : undefined}
              sessionId={sessionId}
              session={session}
              thread={session?.thread ?? (sessionId === created?.id ? created.thread : undefined)}
              scrollRef={conversationScroll}
              onCreated={(id, thread) => {
                setCreated({ id, thread, project })
                ctx.navigate(sessionRoute(id), { replace: true })
              }}
            />
          )}
        </main>
      </div>
    </div>
  )
}

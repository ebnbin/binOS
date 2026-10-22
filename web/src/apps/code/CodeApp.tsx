import { BuildsPage } from '../builds/BuildsPage.tsx'
import { DevicesApp } from '../devices/DevicesApp.tsx'
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

function Conversations({ ctx }: { ctx: WindowContext }) {
  const route = parseRoute(ctx.route)
  const { sessions, projects, failed } = useSessions()
  // 刚建好的 session 可能还没出现在列表里，不能当成不存在
  const [created, setCreated] = useState<{ id: number; kitaSession: string; project: string }>()
  const conversationScroll = useRef<HTMLDivElement>(null)

  const sessionId = route.name === 'session' ? route.id : null
  const session = sessions?.find((item) => item.id === sessionId)
  const project = session?.project ?? (sessionId === created?.id ? created.project : undefined) ?? (route.name === 'new' ? route.project : undefined) ?? 'binos'
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
            onBuild={(ref) => ctx.navigate(`/builds?ref=${encodeURIComponent(ref)}`)}
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
              <button type="button" onClick={() => ctx.navigate('/')}>
                返回对话列表
              </button>
            </div>
          ) : (
            <Conversation
              project={project}
              projects={projects}
              onProject={(id) => ctx.navigate(`/new?project=${encodeURIComponent(id)}`, { replace: true })}
              key={`${sessionId ?? 'new'}-${project}-${route.name === 'session' ? route.item ?? '' : ''}`}
              targetItem={route.name === 'session' ? route.item : undefined}
              sessionId={sessionId}
              session={session}
              thread={session?.kitaSession ?? (sessionId === created?.id ? created.kitaSession : undefined)}
              scrollRef={conversationScroll}
              onCreated={(id, thread) => {
                setCreated({ id, kitaSession: thread, project })
                ctx.navigate(sessionRoute(id), { replace: true })
              }}
            />
          )}
        </main>
      </div>
    </div>
  )
}

export function CodeApp({ ctx }: { ctx: WindowContext }) {
  const tab = ctx.route.startsWith('/builds') ? 'builds' : ctx.route.startsWith('/devices') ? 'devices' : 'sessions'
  const { setTitle } = ctx
  useEffect(() => { if (tab === 'builds') setTitle('构建') }, [tab, setTitle])
  return <div className={styles.development}>
    <nav className={styles.tabs} aria-label="开发导航">
      {([['sessions', '/', '会话'], ['builds', '/builds', '构建'], ['devices', '/devices', '设备']] as const).map(([key, route, label]) => <button key={key} aria-current={tab === key ? 'page' : undefined} onClick={() => ctx.navigate(route)}>{label}</button>)}
    </nav>
    <div className={styles.content}>{tab === 'builds' ? <BuildsPage initialRef={new URLSearchParams(ctx.route.split('?')[1]).get('ref') ?? 'main'} /> : tab === 'devices' ? <DevicesApp ctx={ctx} /> : <Conversations ctx={ctx} />}</div>
  </div>
}

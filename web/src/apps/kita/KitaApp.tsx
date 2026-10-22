import { ArrowLeft, ArrowUp, Check, Feather, Ghost, Heart, Menu, MessageCircle, Plus, Sparkles, Square, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { KitaProfile, Memory } from '@binos/server/services/kita/profile'
import type { AgentId } from '@binos/server/services/kita/types'
import type { WindowContext } from '../types.ts'
import { Transcript } from '../../services/kita/session/Transcript.tsx'
import { useKitaSession } from '../../services/kita/session/useKitaSession.ts'
import { Select } from '../../ui/Select.tsx'
import * as api from './api.ts'
import type { Session } from './api.ts'
import styles from './KitaApp.module.css'

function Avatar({ working = false, small = false }: { working?: boolean; small?: boolean }) {
  return <div className={styles.avatar} data-working={working || undefined} data-small={small || undefined} aria-hidden="true">
    <div className={styles.orbit} /><span className={styles.spark}>✦</span>
    <div className={styles.creature}><i /><i /><span /></div><div className={styles.shadow} />
  </div>
}

export function KitaApp({ ctx }: { ctx: WindowContext }) {
  const [profile, setProfile] = useState<KitaProfile>()
  const [sessions, setSessions] = useState<Session[]>([])
  const [error, setError] = useState('')
  const [menu, setMenu] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const refresh = useCallback(() => { void api.listSessions().then((value) => { setSessions(value); setLoaded(true) }).catch((e: Error) => setError(e.message)) }, [])
  useEffect(() => { ctx.setTitle('Kita'); refresh(); void api.readProfile().then(setProfile).catch((e: Error) => setError(e.message)) }, [ctx, refresh])
  const page = ctx.route === '/memories' ? 'memories' : ctx.route === '/personality' ? 'personality' : 'chat'
  const id = ctx.route.startsWith('/session/') ? ctx.route.slice('/session/'.length) : undefined
  const session = sessions.find((s) => s.id === id)
  const temporary = ctx.route === '/temporary' || session?.temporary === true
  const go = (route: string) => { ctx.navigate(route); setMenu(false) }
  return <div className={styles.app}>
    <div className={styles.layout} data-menu={menu || undefined}>
      <aside className={styles.sidebar}>
        <button className={styles.brand} onClick={() => go('/')}><span className={styles.brandIcon}><Sparkles size={21} /></span><span>Kita<small>你的 binOS 伙伴</small></span></button>
        <button className={styles.newChat} onClick={() => go('/')}><Plus size={16} />新的对话</button>
        <nav className={styles.nav} aria-label="Kita 导航">
          <button data-active={page === 'chat' && !temporary || undefined} onClick={() => go('/')}><MessageCircle size={17} />对话</button>
          <button data-active={page === 'memories' || undefined} onClick={() => go('/memories')}><Heart size={17} />记忆<span>{profile?.memories.length ?? 0}</span></button>
          <button data-active={page === 'personality' || undefined} onClick={() => go('/personality')}><Feather size={17} />性格</button>
        </nav>
        <div className={styles.recentLabel}>最近的对话</div>
        <div className={styles.recents}>
          {sessions.length === 0 && <p>我们的故事，从第一句话开始。</p>}
          {sessions.map((s) => <button key={s.id} data-active={s.id === id || undefined} onClick={() => go(`/session/${s.id}`)}>{s.temporary ? <Ghost size={14} /> : <MessageCircle size={14} />}<span>{s.title}</span>{s.state !== 'idle' && s.state && <i className={styles.dot} />}</button>)}
        </div>
        <button className={styles.temporaryLink} onClick={() => go('/temporary')}><Ghost size={17} /><span>临时对话<small>不带性格与长期记忆</small></span></button>
        <div className={styles.sidebarFoot}><i />在这里，慢慢认识彼此</div>
      </aside>
      <main className={styles.main}>
        <header className={styles.header}><div><button className={styles.menuButton} aria-label={menu ? '关闭导航' : '打开导航'} onClick={() => setMenu(!menu)}>{menu ? <X size={19} /> : <Menu size={19} />}</button><span>{page === 'memories' ? '记忆' : page === 'personality' ? '性格' : temporary ? '临时对话' : '与 Kita 对话'}</span></div><span className={styles.headerNote}>{temporary ? <Ghost size={14} /> : <Sparkles size={14} />}{temporary ? '独立的对话空间' : '一点一点，熟悉起来'}</span></header>
        {error && <div role="alert" className={styles.error}>{error}<button onClick={() => { setError(''); refresh(); void api.readProfile().then(setProfile).catch((e: Error) => setError(e.message)) }}>重试</button></div>}
        {page === 'chat' ? id && !session ? <div className={styles.empty}><p>{loaded ? '这个对话不存在。' : '正在读取对话…'}</p><button onClick={() => go('/')}><ArrowLeft size={14} />返回</button></div> : <Chat key={id ?? ctx.route} session={session} temporary={temporary} refresh={refresh} onCreated={(s) => { setSessions((prev) => [s, ...prev]); go(`/session/${s.id}`) }} memoryCount={profile?.memories.length ?? 0} />
          : profile ? <ProfilePage key={page} page={page} profile={profile} onProfile={setProfile} /> : <div className={styles.empty}>正在读取…</div>}
      </main>
    </div>
  </div>
}

function Chat({ session, temporary, memoryCount, onCreated, refresh }: { session?: Session; temporary: boolean; memoryCount: number; onCreated(s: Session): void; refresh(): void }) {
  const { items, live } = useKitaSession(session?.id)
  const [text, setText] = useState(''), [agent, setAgent] = useState<AgentId>('codex')
  const [sending, setSending] = useState(false), [error, setError] = useState('')
  const scroll = useRef<HTMLDivElement>(null), stick = useRef(true)
  const input = useRef<HTMLTextAreaElement>(null)
  const running = live !== null
  useEffect(() => { refresh() }, [running, refresh])
  useLayoutEffect(() => { if (stick.current && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight }, [items, live])
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!text.trim() || sending || running) return
    setSending(true); setError(''); stick.current = true
    try {
      const target = session ?? await api.createSession(agent, temporary)
      await api.send(target.id, text.trim())
      if (!session) onCreated(target)
      setText(''); refresh()
    } catch (e) { setError((e as Error).message) } finally { setSending(false) }
  }
  const hasConversation = items.some((i) => i.type === 'input')
  return <>
    <div className={styles.conversation} ref={scroll} onScroll={() => { const el = scroll.current; if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100 }}>
      {hasConversation ? <div className={styles.transcript}><div className={styles.conversationIdentity}><Avatar small working={running} /><span>{temporary ? '临时对话' : 'Kita'}<small>{running ? '正在认真想…' : '我在这里'}</small></span></div><Transcript thread={session!.id} items={items} live={live} /></div>
        : <div className={styles.welcome}>
          <div className={styles.eyebrow}>{temporary ? 'A LITTLE SPACE TO THINK' : 'A LITTLE COMPANY, EVERY DAY'}</div>
          {temporary ? <div className={styles.ghostAvatar}><Ghost size={57} strokeWidth={1} /></div> : <Avatar working={sending} />}
          <h1>{temporary ? '从一张白纸开始。' : '嗨，我是喜多。'}</h1>
          <p>{temporary ? '不带入性格和长期记忆，也不写入新的记忆。' : '想聊什么都可以。生活里的小事，或是一个还没成形的想法。'}<br />{temporary ? '本次对话内仍有上下文，聊天记录仍会保存。' : '我在这里，陪你一起想。'}</p>
          {!temporary && <div className={styles.suggestions}>{['今天想和你聊聊', '帮我梳理一个想法', '我们来认识一下彼此'].map((s) => <button key={s} onClick={() => { setText(s); input.current?.focus() }}>{s}<span>↗</span></button>)}</div>}
        </div>}
    </div>
    <div className={styles.composerArea}>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <form className={styles.composer} onSubmit={(e) => { void submit(e) }}>
        <textarea ref={input} aria-label="给 Kita 的消息" placeholder={temporary ? '在这里，自由地想一想…' : '和 Kita 说点什么…'} value={text} maxLength={32000} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit() } }} />
        <div className={styles.composerBottom}><div className={styles.composerMeta}>{session ? <span>{session.agent === 'codex' ? 'Codex' : 'Claude'}</span> : <Select label="对话引擎" value={agent} onValueChange={(v) => setAgent(v as AgentId)} options={[{ value: 'codex', label: 'Codex' }, { value: 'claude', label: 'Claude' }]} />}<span className={styles.contextLabel}>{temporary ? <><Ghost size={12} />不使用长期记忆</> : <><Heart size={12} />{session ? '使用创建时的记忆' : `${memoryCount} 条记忆`}</>}</span></div>
          {running ? <button type="button" className={styles.send} aria-label="停止回答" onClick={() => { void api.stop(session!.id).catch((e: Error) => setError(e.message)) }}><Square size={15} fill="currentColor" /></button> : <button className={styles.send} aria-label="发送消息" disabled={!text.trim() || sending}><ArrowUp size={19} /></button>}
        </div>
      </form>
      <p className={styles.composerHint}>{sending ? '正在把消息交给 Kita…' : temporary ? '临时模式 · 聊天记录仍会保存' : 'Kita 可能会出错。重要的事，我们一起确认。'}</p>
    </div>
  </>
}

function ProfilePage({ page, profile, onProfile }: { page: 'memories' | 'personality'; profile: KitaProfile; onProfile(p: KitaProfile): void }) {
  const [personality, setPersonality] = useState(profile.personality)
  const [text, setText] = useState(''), [editing, setEditing] = useState<Memory>()
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState(''), [error, setError] = useState('')
  async function mutate(action: () => Promise<KitaProfile>, message: string) {
    setBusy(true); setError(''); setNotice('')
    try { onProfile(await action()); setNotice(message); setText(''); setEditing(undefined) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return <div className={styles.settings}>
    <div className={styles.sectionIcon}>{page === 'memories' ? <Heart size={24} /> : <Feather size={24} />}</div>
    <div className={styles.eyebrow}>{page === 'memories' ? 'THE THINGS THAT STAY' : 'A PERSONALITY OF MY OWN'}</div>
    <h1>{page === 'memories' ? '那些，想记住的事。' : '你认识的那个 Kita。'}</h1>
    <p className={styles.description}>{page === 'memories' ? '你来决定，我应该记住什么。这里的每一条，都由你亲手确认。' : '一点温暖，一点好奇，也有自己的判断。你可以调整 Kita 与你相处的方式。'}</p>
    <div className={styles.scopeNote}><Sparkles size={15} /><span>修改在新对话中生效。已有对话保留创建时的性格与记忆。</span></div>
    {error && <p role="alert" className={styles.error}>{error}</p>}{notice && <p role="status" className={styles.success}><Check size={15} />{notice}</p>}
    {page === 'personality' ? <form onSubmit={(e) => { e.preventDefault(); void mutate(() => api.setPersonality(personality), '性格已保存，下次见面就用新的方式。') }}>
      <label className={styles.fieldLabel} htmlFor="kita-personality">Kita 的性格</label><textarea id="kita-personality" className={styles.personalityEditor} value={personality} onChange={(e) => setPersonality(e.target.value)} maxLength={8000} />
      <div className={styles.formFooter}><span>它会影响表达方式，不会改变系统权限。</span><button className={styles.primary} disabled={busy || !personality.trim()}><Check size={15} />保存性格</button></div>
      <div className={styles.about}><Avatar small /><p>形象只是一个开始。<br /><span>真正让 Kita 成为 Kita 的，是一次次交流，以及你愿意留下的记忆。</span></p></div>
    </form> : <>
      <form className={styles.memoryForm} onSubmit={(e) => { e.preventDefault(); void mutate(() => api.saveMemory(text, editing?.id), editing ? '记忆已更新。' : '这件事，已经记下了。') }}>
        <label className={styles.fieldLabel} htmlFor="kita-memory">{editing ? '修改这条记忆' : '告诉 Kita 一件值得记住的事'}</label><textarea id="kita-memory" placeholder="比如：我喜欢直接、简短的回答；我习惯在晚上梳理想法…" maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} />
        <div className={styles.formFooter}><span>仅手动保存，不会自动从聊天中提取。</span><div>{editing && <button type="button" onClick={() => { setEditing(undefined); setText('') }}>取消</button>}<button className={styles.primary} disabled={busy || !text.trim()}><Plus size={15} />{editing ? '保存修改' : '添加记忆'}</button></div></div>
      </form>
      <div className={styles.memoryHeading}>共同的记忆<span>{profile.memories.length} 条</span></div>
      {profile.memories.length === 0 ? <div className={styles.memoryEmpty}><Heart size={27} strokeWidth={1.2} /><p>还没有记忆，也没关系。</p><span>从一件关于你的小事开始。</span></div> : profile.memories.map((m) => <article className={styles.memory} key={m.id}><p>{m.text}</p><div><span>你亲手确认 · {new Date(m.updatedAt).toLocaleDateString('zh-CN')}</span><button disabled={busy} onClick={() => { setEditing(m); setText(m.text); document.getElementById('kita-memory')?.focus() }}>修改</button><button disabled={busy} aria-label={`删除记忆：${m.text}`} onClick={() => { void mutate(() => api.deleteMemory(m.id), '这条记忆已删除。') }}><Trash2 size={14} /></button></div></article>)}
    </>}
  </div>
}

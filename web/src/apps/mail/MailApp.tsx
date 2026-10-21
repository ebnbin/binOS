import { ArrowLeft, Download, ExternalLink, Inbox, Mail, MailOpen, Paperclip, RefreshCw, Search, Settings, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { MailAttachment, MailMessage, MailPage, MailStatus, MailSummary, MailThread } from '@binos/server/apps/mail/types'
import type { WindowContext } from '../types.ts'
import { onChange } from '../../events.ts'
import { mailBase, mailRequest } from './api.ts'
import styles from './MailApp.module.css'

const errorText = (error: unknown) => error instanceof Error ? error.message : '邮件操作失败'
const dateText = (date: number) => date ? new Date(date).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
const attachmentUrl = (message: string, part: number) => `${mailBase}/messages/${message}/attachments/${part}`
const sizeText = (size: number) => size < 1024 ? `${size} B` : size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`

export function MailApp({ ctx }: { ctx: WindowContext }) {
  const selected = /^\/thread\/([\w-]+)$/.exec(ctx.route)?.[1]
  const [status, setStatus] = useState<MailStatus>()
  const [settings, setSettings] = useState(false)
  const [folder, setFolder] = useState('in:inbox')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState<MailPage>()
  const [thread, setThread] = useState<MailThread>()
  const [error, setError] = useState('')
  const [threadError, setThreadError] = useState('')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const latest = useRef(0)
  const queryKey = `${folder}\n${query}`
  const activeKey = useRef(queryKey)
  const { setTitle } = ctx
  useEffect(() => setTitle(thread?.messages.at(-1)?.subject || 'Mail'), [setTitle, thread])

  const loadStatus = useCallback(async () => {
    const result = await mailRequest<MailStatus>('/account')
    setStatus(result)
    return result
  }, [])
  useEffect(() => {
    const initial = setTimeout(() => void loadStatus().catch((error) => setError(errorText(error))), 0)
    const stop = onChange((event) => {
      if (event === null || event.type === 'mail') {
        void loadStatus().then((result) => { if (result.connected) setRevision((value) => value + 1) }).catch((error) => setError(errorText(error)))
      }
    })
    return () => { clearTimeout(initial); stop() }
  }, [loadStatus])

  const loadPage = useCallback(async (next?: string) => {
    const version = ++latest.current
    const key = queryKey
    setLoading(true)
    try {
      const params = new URLSearchParams({ q: [folder, query].filter(Boolean).join(' '), ...(next && { page: next }) })
      const result = await mailRequest<MailPage>(`/threads?${params}`)
      if (latest.current !== version || activeKey.current !== key) return
      setPage((previous) => next ? { ...result, cached: result.cached || previous?.cached, threads: [...new Map([...(previous?.threads ?? []), ...result.threads].map((item) => [item.id, item])).values()] } : result)
      setError('')
    } catch (error) { if (latest.current === version && activeKey.current === key) setError(errorText(error)) }
    finally { if (latest.current === version) setLoading(false) }
  }, [folder, query, queryKey])

  useEffect(() => {
    const changed = activeKey.current !== queryKey
    activeKey.current = queryKey
    const initial = setTimeout(() => {
      if (changed || !status?.connected) setPage(undefined)
      if (status?.connected) void loadPage()
    }, 0)
    return () => clearTimeout(initial)
  }, [revision, status?.connected, loadPage, queryKey])

  useEffect(() => {
    let cancelled = false
    const initial = setTimeout(() => {
      setThread(undefined)
      setThreadError('')
      if (!selected || !status?.connected) return
      void mailRequest<MailThread>(`/threads/${selected}`).then(async (result) => {
      if (cancelled) return
      setThread(result)
      if (!result.cached && result.messages.some((message) => message.labels.includes('UNREAD'))) {
        try {
          await mailRequest(`/threads/${selected}/read`, { method: 'POST', body: { read: true } })
          if (!cancelled) setThread((previous) => previous && { ...previous, messages: previous.messages.map((message) => ({ ...message, labels: message.labels.filter((label) => label !== 'UNREAD') })) })
        } catch (error) { if (!cancelled) setThreadError(errorText(error)) }
      }
      }).catch((error) => { if (!cancelled) setThreadError(errorText(error)) })
    }, 0)
    return () => { cancelled = true; clearTimeout(initial) }
  }, [selected, status?.connected])

  useEffect(() => {
    let cancelled = false
    if (!revision || !selected || !status?.connected) return
    void mailRequest<MailThread>(`/threads/${selected}`).then((result) => { if (!cancelled) setThread(result) }).catch((error) => { if (!cancelled) setThreadError(errorText(error)) })
    return () => { cancelled = true }
  }, [revision, selected, status?.connected])

  async function act(operation: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try { await operation(); await loadStatus() }
    catch (error) { setError(errorText(error)) }
    finally { setBusy(false) }
  }

  async function refresh() {
    await mailRequest('/sync', { method: 'POST' })
    await loadPage()
    if (selected) setThread(await mailRequest<MailThread>(`/threads/${selected}`))
    setThreadError('')
  }

  if (!status) return <div className={styles.center}><Mail size={32} /><p>{error || '正在打开 Mail…'}</p>{error && <button onClick={() => void loadStatus().catch((error) => setError(errorText(error)))}>重试</button>}</div>

  if (settings || !status.connected) return <div className={styles.app}><AccountSettings key={status.clientId} status={status} busy={busy} error={error} act={act} onClose={status.connected ? () => setSettings(false) : undefined} onDisconnect={async () => { await mailRequest('/account', { method: 'DELETE' }); setThread(undefined); setPage(undefined); ctx.navigate('/'); setSettings(false) }} /></div>

  return <div className={styles.app}>
    <div className={styles.layout} data-view={selected ? 'thread' : 'list'}>
      <aside className={styles.listPane}>
        <header className={styles.header}>
          <div className={styles.brand}><Mail size={23} /><div><strong>Mail</strong><small title={status.email}>{status.email}</small></div></div>
          <button className={styles.icon} title="账号设置" aria-label="账号设置" onClick={() => setSettings(true)}><Settings size={18} /></button>
          <button className={styles.icon} title="刷新邮件" aria-label="刷新邮件" disabled={busy || status.syncing} onClick={() => void act(refresh)}><RefreshCw size={18} className={busy || status.syncing ? styles.spinning : ''} /></button>
        </header>
        <form className={styles.search} onSubmit={(event) => { event.preventDefault(); setQuery(search.trim()); ctx.navigate('/') }}>
          <Search size={17} /><input aria-label="搜索邮件" placeholder="搜索邮件" value={search} onChange={(event) => setSearch(event.target.value)} /><button type="submit">搜索</button>
        </form>
        <div className={styles.filters}><select aria-label="邮箱" value={folder} onChange={(event) => { setFolder(event.target.value); ctx.navigate('/') }}><option value="in:inbox">收件箱</option><option value="">所有邮件</option><option value="in:sent">已发送</option><option value="is:starred">星标</option><option value="in:spam">垃圾邮件</option><option value="in:trash">垃圾箱</option></select><span>{loading ? '正在加载…' : status.lastSync ? `${new Date(status.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 已同步` : '等待同步'}</span></div>
        {(error || status.error) && <div className={styles.error} role="alert">{error || status.error}<button onClick={() => void act(refresh)}>重试</button>{status.error?.includes('授权') && <button onClick={() => setSettings(true)}>重新连接</button>}</div>}
        {page?.cached && <p className={styles.notice}>当前显示本地缓存，邮件列表可能不是最新。联网后可刷新。</p>}
        <div className={styles.list}>
          {page?.threads.map((item) => <MailRow key={item.id} item={item} selected={item.id === selected} open={() => ctx.navigate(`/thread/${item.id}`)} />)}
          {!page?.threads.length && <div className={styles.empty}><Inbox size={30} strokeWidth={1.2} /><p>{loading ? '正在读取邮件…' : error ? '暂时无法读取邮件' : query ? '没有找到匹配的邮件' : '这里还没有邮件'}</p></div>}
          {page?.next && <button className={styles.more} disabled={loading} onClick={() => void loadPage(page.next)}>{loading ? '正在加载…' : '加载更多邮件'}</button>}
        </div>
      </aside>
      <main className={styles.threadPane}>
        {selected ? <>
          <header className={styles.threadHeader}><button className={styles.icon} aria-label="返回邮件列表" onClick={() => ctx.navigate('/')}><ArrowLeft size={19} /></button><span>{thread?.messages.at(-1)?.subject || '邮件'}</span>{thread && <button className={styles.textButton} disabled={busy || thread.cached} onClick={() => void act(async () => {
            const read = thread.messages.some((message) => message.labels.includes('UNREAD'))
            await mailRequest(`/threads/${selected}/read`, { method: 'POST', body: { read } })
            setThread((previous) => previous && { ...previous, messages: previous.messages.map((message) => ({ ...message, labels: read ? message.labels.filter((label) => label !== 'UNREAD') : [...new Set([...message.labels, 'UNREAD'])] })) })
          })}><MailOpen size={16} />{thread.messages.some((message) => message.labels.includes('UNREAD')) ? '标为已读' : '标为未读'}</button>}</header>
          {threadError && <p className={styles.error} role="alert">{threadError}<button onClick={() => void act(refresh)}>重试</button></p>}
          {thread?.cached && <p className={styles.notice}>正在阅读缓存的会话，联网后刷新可获取后续邮件。</p>}
          <div className={styles.conversation}>
            {!thread && !threadError && <p className={styles.empty}>正在加载完整会话…</p>}
            {thread && <h1>{thread.messages.at(-1)?.subject || '（无主题）'}</h1>}
            {thread?.messages.map((message, index) => <Message key={message.id} message={message} expanded={index === thread.messages.length - 1} />)}
          </div>
        </> : <div className={styles.center}><MailOpen size={44} strokeWidth={1} /><h2>你的邮件，在这里</h2><p>选择一封邮件，阅读完整内容和往来。</p></div>}
      </main>
    </div>
  </div>
}

function MailRow({ item, selected, open }: { item: MailSummary; selected: boolean; open(): void }) {
  return <button className={styles.row} data-selected={selected} data-unread={item.labels.includes('UNREAD')} onClick={open}>
    <div className={styles.rowTop}><strong>{item.from || '未知发件人'}</strong><time>{item.date ? new Date(item.date).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}</time></div>
    <div className={styles.subject}>{item.subject || '（无主题）'}</div><p>{item.snippet}</p>
  </button>
}

function Message({ message, expanded }: { message: MailMessage; expanded: boolean }) {
  const [open, setOpen] = useState(expanded)
  return <article className={styles.message}>
    <button className={styles.messageHead} aria-expanded={open} onClick={() => setOpen(!open)}><span className={styles.avatar}>{(message.from || '?').charAt(0).toUpperCase()}</span><span><strong>{message.from || '未知发件人'}</strong><small>发给 {message.to || '未指定收件人'}</small></span><time>{dateText(message.date)}</time></button>
    {open && <><dl className={styles.addresses}><div><dt>收件人</dt><dd>{message.to || '未指定'}</dd></div>{message.cc && <div><dt>抄送</dt><dd>{message.cc}</dd></div>}{message.bcc && <div><dt>密送</dt><dd>{message.bcc}</dd></div>}{message.replyTo && <div><dt>回复至</dt><dd>{message.replyTo}</dd></div>}</dl>
      {message.warnings.map((warning) => <p className={styles.notice} key={warning}>{warning}</p>)}
      <MessageBody id={message.id} text={message.text} hasHtml={Boolean(message.html)} />
      {message.attachments.length > 0 && <div className={styles.attachments}><h3><Paperclip size={15} />{message.attachments.length} 个附件</h3>{message.attachments.map((item) => <Attachment key={item.id} messageId={message.id} item={item} />)}</div>}
      <a className={styles.original} href={`${mailBase}/messages/${message.id}/original`}><Download size={14} />下载原始邮件 (.eml)</a>
    </>}
  </article>
}

function MessageBody({ id, text, hasHtml }: { id: string; text: string; hasHtml: boolean }) {
  const [html, setHtml] = useState('')
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  const [plain, setPlain] = useState(false)
  useEffect(() => {
    if (!hasHtml) return
    const controller = new AbortController()
    void mailRequest<{ html: string }>(`/messages/${id}/body`, { method: 'GET', signal: controller.signal }).then((result) => { setHtml(result.html); setError('') }).catch((error) => { if (!controller.signal.aborted) setError(errorText(error)) })
    return () => controller.abort()
  }, [id, version, hasHtml])
  return <div className={styles.body}>
    {hasHtml && text && <button className={styles.bodyToggle} onClick={() => setPlain(!plain)}>{plain ? '查看 HTML 正文' : '查看纯文本版本'}</button>}
    {plain || !hasHtml ? <pre className={styles.plain}>{text}</pre> : html ? <iframe title="邮件正文" srcDoc={html} sandbox="allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" /> : <p className={error ? styles.error : styles.empty}>{error || '正在加载正文…'}{error && <button onClick={() => setVersion((value) => value + 1)}>重试</button>}</p>}
  </div>
}

function Attachment({ messageId, item }: { messageId: string; item: MailAttachment }) {
  const [preview, setPreview] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const previewable = /^image\/(png|jpeg|gif|webp|avif|bmp|x-icon|svg\+xml)$/.test(item.type) || item.type === 'application/pdf'
  const alive = useRef(true)
  const blobUrl = useRef('')
  useEffect(() => { alive.current = true; return () => { alive.current = false; URL.revokeObjectURL(blobUrl.current) } }, [])
  function close() { URL.revokeObjectURL(blobUrl.current); blobUrl.current = ''; setPreview('') }
  async function open() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(attachmentUrl(messageId, item.id))
      if (!response.ok) throw new Error('附件加载失败，请重试')
      const blob = await response.blob()
      if (alive.current) { URL.revokeObjectURL(blobUrl.current); blobUrl.current = URL.createObjectURL(blob); setPreview(blobUrl.current) }
    } catch (error) { if (alive.current) setError(errorText(error)) }
    finally { if (alive.current) setLoading(false) }
  }
  return <div className={styles.attachment}>
    <Paperclip size={16} /><span><strong>{item.name}</strong><small>{sizeText(item.size)}{item.cid ? ' · 内嵌资源' : ''}</small></span>
    {previewable && <button disabled={loading} onClick={() => void open()}>{loading ? '加载中…' : '预览'}</button>}<a href={attachmentUrl(messageId, item.id)} aria-label={`下载 ${item.name}`}><Download size={17} /></a>
    {error && <p className={styles.error}>{error}</p>}
    {preview && <div className={styles.preview} role="dialog" aria-modal="true" aria-label={item.name} onKeyDown={(event) => { if (event.key === 'Escape') close() }}><header><strong>{item.name}</strong><button autoFocus aria-label="关闭预览" onClick={close}><X size={22} /></button></header>{item.type === 'application/pdf' ? <iframe title={item.name} src={preview} /> : <img src={preview} alt={item.name} />}</div>}
  </div>
}

function AccountSettings({ status, busy, error, act, onClose, onDisconnect }: { status: MailStatus; busy: boolean; error: string; act(operation: () => Promise<unknown>): Promise<void>; onClose?: () => void; onDisconnect(): Promise<void> }) {
  const [clientId, setClientId] = useState(status.clientId ?? '')
  const [secret, setSecret] = useState('')
  const [redirectUri, setRedirectUri] = useState(status.redirectUri ?? `${window.location.origin}/api/apps/mail/oauth/callback`)
  const [localError, setLocalError] = useState('')
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  async function connect() {
    const result = await mailRequest<{ url: string }>('/oauth/start', { method: 'POST' })
    window.location.assign(result.url)
  }
  function save(event: FormEvent) {
    event.preventDefault()
    void act(async () => { await mailRequest('/account', { method: 'PUT', body: { clientId, clientSecret: secret, redirectUri } }); setSecret('') })
  }
  return <section className={styles.settings}>
    <div className={styles.settingsTitle}>{onClose && <button className={styles.icon} aria-label="返回邮件" onClick={onClose}><ArrowLeft size={19} /></button>}<Mail size={28} /><h1>{status.connected ? '邮件账号' : '连接你的 Gmail'}</h1></div>
    <p>在 binOS 中阅读完整邮件、查看往来与附件。</p>
    {(error || localError) && <p className={styles.error} role="alert">{error || localError}</p>}
    {status.connected ? <div className={styles.connection}><strong>{status.email}</strong><p>{status.lastSync ? `上次同步：${dateText(status.lastSync)}` : '正在准备首次同步'}</p>{status.error && <p className={styles.error}>{status.error}</p>}<button className={styles.primary} disabled={busy} onClick={() => void act(connect)}>重新授权</button>{confirmDisconnect ? <div className={styles.disconnect}><p>断开账号会清除本机邮件缓存，Gmail 中的邮件会保留。</p><button disabled={busy} onClick={() => void act(onDisconnect)}>确认断开</button><button onClick={() => setConfirmDisconnect(false)}>取消</button></div> : <button className={styles.secondary} disabled={busy} onClick={() => setConfirmDisconnect(true)}>断开账号</button>}</div> : <>
      <ol className={styles.steps}><li>在 <a href="https://console.cloud.google.com/apis/library/gmail.googleapis.com" target="_blank" rel="noreferrer">Google Cloud <ExternalLink size={12} /></a> 创建项目，启用 Gmail API。</li><li>配置 OAuth 同意屏幕，创建“Web 应用”客户端。</li><li>将下方回调地址添加到“已获授权的重定向 URI”。</li><li>导入客户端 JSON 或填写配置，然后连接 Gmail。长期使用请将 OAuth 应用设为生产状态，避免测试授权在 7 天后过期。</li></ol>
      <form className={styles.config} onSubmit={save}>
        <label>回调地址<input aria-label="回调地址" value={redirectUri} onChange={(event) => setRedirectUri(event.target.value)} required type="url" /></label>
        <label className={styles.import}>导入 Google OAuth 客户端 JSON<input aria-label="导入客户端 JSON" type="file" accept="application/json,.json" onChange={(event) => {
          const file = event.target.files?.[0]
          if (!file) return
          void file.text().then((text) => {
            const data = JSON.parse(text) as { web?: { client_id?: string; client_secret?: string } }
            if (!data.web?.client_id || !data.web.client_secret) throw new Error('请选择 Web 应用类型的 OAuth 客户端 JSON')
            setClientId(data.web.client_id); setSecret(data.web.client_secret); setLocalError('')
          }).catch((error) => setLocalError(errorText(error)))
          event.target.value = ''
        }} /></label>
        <label>Client ID<input aria-label="Client ID" autoComplete="off" value={clientId} onChange={(event) => setClientId(event.target.value)} placeholder="…apps.googleusercontent.com" required /></label>
        <label>Client secret<input aria-label="Client secret" type="password" autoComplete="new-password" value={secret} onChange={(event) => setSecret(event.target.value)} required /></label>
        <div className={styles.configActions}><button className={styles.secondary} type="submit" disabled={busy}>保存配置</button>{status.configured && <button className={styles.primary} type="button" disabled={busy} onClick={() => void act(connect)}>连接 Gmail</button>}</div>
      </form>
      <p className={styles.hint}>凭证仅保存在这台 binOS 的后端。开发实例和 PR 预览使用各自独立的账号配置与缓存。</p>
    </>}
  </section>
}

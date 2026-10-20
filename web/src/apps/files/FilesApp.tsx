import { ArrowLeft, ArrowUp, ChevronRight, Download, File, Folder, Home, List, LayoutGrid, RefreshCw, Search, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { FilePreview } from '../../ui/files/FileBlock.tsx'
import type { AppContext } from '../types.ts'
import styles from './FilesApp.module.css'

type Entry = { name: string; path: string; directory: boolean; symlink: boolean; size: number; modified: number }
type Listing = { path: string; parent: string; home: string; entries: Entry[] }
const base = '/api/apps/files'
async function request(url: string, init?: RequestInit) {
  const response = await fetch(base + url, init)
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || '文件操作失败')
  return data
}
const size = (bytes: number) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1048576
      ? `${(bytes / 1024).toFixed(1)} KB`
      : bytes < 1073741824
        ? `${(bytes / 1048576).toFixed(1)} MB`
        : `${(bytes / 1073741824).toFixed(1)} GB`

export function FilesApp({ ctx }: { ctx: AppContext }) {
  const [listing, setListing] = useState<Listing>()
  const [location, setLocation] = useState('')
  const [preview, setPreview] = useState<Entry>()
  const [search, setSearch] = useState('')
  const [hidden, setHidden] = useState(false)
  const [grid, setGrid] = useState(false)
  const [sort, setSort] = useState('name')
  const [selected, setSelected] = useState<string[]>([])
  const [clipboard, setClipboard] = useState<{ paths: string[]; move: boolean }>()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState<{ action: 'mkdir' | 'rename' | 'trash'; value: string }>()
  const upload = useRef<HTMLInputElement>(null)
  const sequence = useRef(0)
  const route = ctx.route ? decodeURIComponent(ctx.route.slice(1)) : ''
  const { setTitle } = ctx
  useEffect(() => {
    setTitle(listing ? listing.path.split('/').pop() || 'Macintosh HD' : '文件')
  }, [listing, setTitle])
  async function load(dir: string, clearError = true) {
    const id = ++sequence.current
    setLoading(true)
    if (clearError) setError('')
    setSelected([])
    try {
      const data: Listing = await request(`?${new URLSearchParams({ path: dir })}`)
      if (id === sequence.current) {
        setListing(data)
        setLocation(data.path)
      }
    } catch (e) {
      if (id === sequence.current) setError(String(e instanceof Error ? e.message : e))
    } finally {
      if (id === sequence.current) setLoading(false)
    }
  }
  useEffect(() => {
    void Promise.resolve().then(() => {
      setSearch('')
      return load(route)
    })
  }, [route])
  const go = (dir: string) => ctx.navigate('/' + encodeURIComponent(dir))
  async function operation(action: string, file: string, extra = {}) {
    await request('/operation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, path: file, ...extra }) })
  }
  async function run(task: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await task()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setDialog(undefined)
      setBusy(false)
      await load(listing?.path || route, false)
    }
  }
  const entries = (listing?.entries || [])
    .filter((e) => (hidden || !e.name.startsWith('.')) && e.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
    .sort(
      (a, b) =>
        Number(b.directory) - Number(a.directory) ||
        (sort === 'modified' ? b.modified - a.modified : sort === 'size' ? b.size - a.size : a.name.localeCompare(b.name, 'zh-CN', { numeric: true })),
    )
  const current = listing?.entries.find((e) => e.path === selected[0])
  const download = (file: string) => `${base}/download?${new URLSearchParams({ path: file })}`
  function select(entry: Entry, multi: boolean) {
    setSelected((old) => (multi ? (old.includes(entry.path) ? old.filter((p) => p !== entry.path) : [...old, entry.path]) : [entry.path]))
  }
  return (
    <div className={styles.app}>
      <aside className={styles.sidebar}>
        <div className={styles.caption}>个人收藏</div>
        {listing &&
          [
            ['个人目录', listing.home],
            ['桌面', listing.home + '/Desktop'],
            ['文稿', listing.home + '/Documents'],
            ['下载', listing.home + '/Downloads'],
            ['图片', listing.home + '/Pictures'],
          ].map(([label, dir]) => (
            <button key={dir} className={listing.path === dir ? styles.active : ''} disabled={busy} onClick={() => go(dir)}>
              <Folder size={17} />
              {label}
            </button>
          ))}
        <div className={styles.caption}>位置</div>
        <button disabled={busy} onClick={() => go('/')}>
          <Home size={17} />
          Macintosh HD
        </button>
        <button disabled={busy} onClick={() => go('/Volumes')}>
          <Folder size={17} />
          外置磁盘
        </button>
        {listing && (
          <button disabled={busy} onClick={() => go(listing.home + '/.Trash')}>
            <Folder size={17} />
            废纸篓
          </button>
        )}
      </aside>
      <main className={styles.main}>
        <header className={styles.toolbar}>
          <button title="后退" aria-label="后退" disabled={busy} onClick={ctx.back}>
            <ArrowLeft size={18} />
          </button>
          <button
            title="上一级"
            aria-label="上一级"
            disabled={busy || !listing || listing.parent === listing.path}
            onClick={() => listing && go(listing.parent)}
          >
            <ArrowUp size={18} />
          </button>
          <form
            className={styles.path}
            onSubmit={(e) => {
              e.preventDefault()
              go(location)
            }}
          >
            <input aria-label="文件夹路径" disabled={busy} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="输入绝对路径" />
          </form>
          <button title="刷新" aria-label="刷新" disabled={loading || busy} onClick={() => void load(route)}>
            <RefreshCw size={17} />
          </button>
          <button title={grid ? '列表视图' : '图标视图'} aria-label="切换视图" onClick={() => setGrid(!grid)}>
            {grid ? <List size={18} /> : <LayoutGrid size={18} />}
          </button>
        </header>
        <div className={styles.controls}>
          <label className={styles.search}>
            <Search size={15} />
            <input aria-label="搜索当前文件夹" placeholder="搜索当前文件夹" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <select aria-label="排序" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="name">名称</option>
            <option value="modified">修改时间</option>
            <option value="size">大小</option>
          </select>
          <label>
            <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} />
            隐藏文件
          </label>
        </div>
        <div className={styles.actions}>
          <button disabled={busy || !listing || loading} onClick={() => setDialog({ action: 'mkdir', value: '未命名文件夹' })}>
            新建文件夹
          </button>
          <button disabled={busy || !listing || loading} onClick={() => upload.current?.click()}>
            <Upload size={14} />
            上传
          </button>
          <button disabled={busy || selected.length !== 1} onClick={() => current && (current.directory ? go(current.path) : setPreview(current))}>
            打开
          </button>
          <button disabled={busy || selected.length !== 1} onClick={() => setDialog({ action: 'rename', value: current?.name || '' })}>
            重命名
          </button>
          <button disabled={!selected.length || busy} onClick={() => setClipboard({ paths: selected, move: false })}>
            复制
          </button>
          <button disabled={!selected.length || busy} onClick={() => setClipboard({ paths: selected, move: true })}>
            剪切
          </button>
          <button
            disabled={!clipboard || busy || !listing || loading}
            onClick={() =>
              void run(async () => {
                for (const file of clipboard!.paths) await operation(clipboard!.move ? 'move' : 'copy', file, { destination: listing!.path })
                setClipboard(undefined)
              })
            }
          >
            粘贴{clipboard ? ` (${clipboard.paths.length})` : ''}
          </button>
          <button disabled={!selected.length || busy} onClick={() => setDialog({ action: 'trash', value: '' })}>
            移到废纸篓
          </button>
          {current && selected.length === 1 && !current.directory && (
            <a href={download(current.path) + `&name=${encodeURIComponent(current.name)}`}>
              <Download size={14} />
              下载
            </a>
          )}
          <input
            ref={upload}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              const files = Array.from(e.target.files || [])
              e.target.value = ''
              void run(async () => {
                for (const file of files)
                  await request(`/upload?${new URLSearchParams({ path: listing!.path, name: file.name })}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/octet-stream' },
                    body: file,
                  })
              })
            }}
          />
        </div>
        {error && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}
        <div className={styles.content} aria-busy={loading || busy}>
          {loading ? (
            <p className={styles.empty}>正在读取…</p>
          ) : entries.length === 0 ? (
            <p className={styles.empty}>{search ? '没有匹配的文件' : '此文件夹为空'}</p>
          ) : (
            <div className={grid ? styles.grid : styles.list}>
              {!grid && (
                <div className={styles.columns}>
                  <span>名称</span>
                  <span>修改时间</span>
                  <span>大小</span>
                </div>
              )}
              {entries.map((entry) => (
                <button
                  key={entry.path}
                  disabled={busy}
                  className={`${styles.entry} ${selected.includes(entry.path) ? styles.selected : ''}`}
                  aria-pressed={selected.includes(entry.path)}
                  onClick={(e) => select(entry, e.metaKey || e.ctrlKey || e.shiftKey)}
                  onDoubleClick={() => (entry.directory ? go(entry.path) : setPreview(entry))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (entry.directory) go(entry.path)
                      else setPreview(entry)
                    } else if (e.key === ' ' && !entry.directory) {
                      e.preventDefault()
                      setPreview(entry)
                    }
                  }}
                >
                  <span className={styles.name}>
                    {entry.directory ? <Folder className={styles.folder} size={grid ? 48 : 19} /> : <File size={grid ? 44 : 18} />}
                    <span>
                      {entry.name}
                      {entry.symlink ? ' ↗' : ''}
                    </span>
                    {entry.directory && !grid && <ChevronRight size={13} />}
                  </span>
                  {!grid && (
                    <>
                      <span className={styles.meta}>
                        {entry.modified ? new Date(entry.modified).toLocaleString('zh-CN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                      </span>
                      <span className={styles.meta}>{entry.directory ? '—' : size(entry.size)}</span>
                    </>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <footer className={styles.status}>
          {entries.length} 个项目{selected.length > 0 && ` · 已选 ${selected.length} 项`}
          {busy && ' · 正在处理…'}
          <span>{listing?.path}</span>
        </footer>
      </main>
      {preview && (
        <FilePreview
          item={{ thread: '', file: preview.path, name: preview.name, path: preview.path, url: download(preview.path) }}
          close={() => setPreview(undefined)}
        />
      )}
      {dialog && (
        <div className={styles.scrim}>
          <form
            className={styles.dialog}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && !busy) setDialog(undefined)
            }}
            role="dialog"
            aria-modal="true"
            aria-label={dialog.action === 'trash' ? '移到废纸篓' : '输入名称'}
            onSubmit={(e) => {
              e.preventDefault()
              void run(async () => {
                if (dialog.action === 'trash') {
                  for (const file of selected) await operation('trash', file)
                } else await operation(dialog.action, dialog.action === 'mkdir' ? listing!.path : selected[0], { name: dialog.value })
              })
            }}
          >
            <strong>{dialog.action === 'trash' ? `将 ${selected.length} 个项目移到废纸篓？` : dialog.action === 'mkdir' ? '新建文件夹' : '重命名'}</strong>
            {dialog.action === 'trash' ? (
              <p>文件会移到 macOS 的废纸篓。</p>
            ) : (
              <input
                autoFocus
                aria-label="名称"
                value={dialog.value}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setDialog({ ...dialog, value: e.target.value })}
              />
            )}
            <div>
              <button type="button" disabled={busy} onClick={() => setDialog(undefined)}>
                取消
              </button>
              <button disabled={busy || (dialog.action !== 'trash' && !dialog.value.trim())}>确认</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

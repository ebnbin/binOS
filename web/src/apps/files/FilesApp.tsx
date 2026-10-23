import { ModalHost } from '../../shell/hosts/ModalHost.tsx'
import { ActionButton } from '../../ui/ActionButton.tsx'
import actionButton from '../../ui/ActionButton.module.css'
import { Button } from '../../ui/Button.tsx'
import { Checkbox } from '../../ui/Checkbox.tsx'
import dialogStyles from '../../ui/Dialog.module.css'
import field from '../../ui/Field.module.css'
import { IconButton } from '../../ui/IconButton.tsx'
import {
  ChevronLeft,
  ChevronUp,
  Copy,
  Cut,
  Delete,
  Download,
  File,
  Folder,
  FolderAdd,
  FolderOpen,
  Home,
  Paste,
  Refresh,
  Rename,
  Search,
  Upload,
  ViewGrid,
  ViewList,
} from '../../ui/icons.tsx'
import type { Icon as IconType } from '../../ui/icons.tsx'
import { InlineAlert } from '../../ui/InlineAlert.tsx'
import { ProgressCircle } from '../../ui/ProgressCircle.tsx'
import segmented from '../../ui/SegmentedControl.module.css'
import { Select } from '../../ui/Select.tsx'
import { UiIcon } from '../../ui/UiIcon.tsx'
import { useEffect, useRef, useState } from 'react'
import { FilePreview } from '../../services/preview/index.ts'
import type { WindowContext } from '../types.ts'
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

export function FilesApp({ ctx }: { ctx: WindowContext }) {
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
  const operationBusy = useRef(false)
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
    if (operationBusy.current) return
    operationBusy.current = true
    setBusy(true)
    setError('')
    try {
      await task()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setDialog(undefined)
      await load(listing?.path || route, false)
      operationBusy.current = false
      setBusy(false)
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
  const sidebarItem = (label: string, dir: string, Icon: IconType) => (
    <button key={dir} type="button" className={styles.navItem} data-current={listing?.path === dir} disabled={busy} onClick={() => go(dir)}>
      <Icon size="M" />
      {label}
    </button>
  )
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
          ].map(([label, dir]) => sidebarItem(label, dir, Folder))}
        <div className={styles.caption}>位置</div>
        {sidebarItem('Macintosh HD', '/', Home)}
        {sidebarItem('外置磁盘', '/Volumes', Folder)}
        {listing && sidebarItem('废纸篓', listing.home + '/.Trash', Delete)}
      </aside>
      <main className={styles.main}>
        <header className={styles.toolbar}>
          <IconButton icon={ChevronLeft} label="后退" disabled={busy} onClick={ctx.back} />
          <IconButton
            icon={ChevronUp}
            label="上一级"
            disabled={busy || !listing || listing.parent === listing.path}
            onClick={() => listing && go(listing.parent)}
          />
          <form
            className={styles.path}
            onSubmit={(e) => {
              e.preventDefault()
              go(location)
            }}
          >
            <input
              className={`${field.textField} ${styles.pathInput}`}
              aria-label="文件夹路径"
              disabled={busy}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="输入绝对路径"
              spellCheck={false}
            />
          </form>
          <IconButton icon={Refresh} label="刷新" disabled={loading || busy} onClick={() => void load(route)} />
          <div className={segmented.control} role="group" aria-label="视图">
            <button type="button" className={segmented.item} aria-pressed={!grid} aria-label="列表视图" title="列表视图" onClick={() => setGrid(false)}>
              <ViewList />
            </button>
            <button type="button" className={segmented.item} aria-pressed={grid} aria-label="图标视图" title="图标视图" onClick={() => setGrid(true)}>
              <ViewGrid />
            </button>
          </div>
        </header>
        <div className={styles.controls}>
          <label className={`${field.group} ${field.search} ${styles.search}`}>
            <Search size="M" className={field.prefix} />
            <input
              className={field.groupInput}
              type="search"
              aria-label="搜索当前文件夹"
              placeholder="搜索当前文件夹"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button type="button" className={field.clear} aria-label="清除搜索" onClick={() => setSearch('')}>
                <UiIcon glyph="cross" />
              </button>
            )}
          </label>
          <Select
            label="排序"
            value={sort}
            onValueChange={setSort}
            options={[
              { value: 'name', label: '名称' },
              { value: 'modified', label: '修改时间' },
              { value: 'size', label: '大小' },
            ]}
          />
          <Checkbox label="隐藏文件" checked={hidden} onCheckedChange={setHidden} />
        </div>
        <div className={styles.actions}>
          <ActionButton
            quiet
            icon={FolderAdd}
            label="新建文件夹"
            disabled={busy || !listing || loading}
            onClick={() => setDialog({ action: 'mkdir', value: '未命名文件夹' })}
          >
            新建文件夹
          </ActionButton>
          <ActionButton quiet icon={Upload} label="上传" disabled={busy || !listing || loading} onClick={() => upload.current?.click()}>
            上传
          </ActionButton>
          <ActionButton
            quiet
            icon={FolderOpen}
            label="打开"
            disabled={busy || selected.length !== 1}
            onClick={() => current && (current.directory ? go(current.path) : setPreview(current))}
          >
            打开
          </ActionButton>
          <ActionButton
            quiet
            icon={Rename}
            label="重命名"
            disabled={busy || selected.length !== 1}
            onClick={() => setDialog({ action: 'rename', value: current?.name || '' })}
          >
            重命名
          </ActionButton>
          <ActionButton quiet icon={Copy} label="复制" disabled={!selected.length || busy} onClick={() => setClipboard({ paths: selected, move: false })}>
            复制
          </ActionButton>
          <ActionButton quiet icon={Cut} label="剪切" disabled={!selected.length || busy} onClick={() => setClipboard({ paths: selected, move: true })}>
            剪切
          </ActionButton>
          <ActionButton
            quiet
            icon={Paste}
            label="粘贴"
            disabled={!clipboard || busy || !listing || loading}
            onClick={() =>
              void run(async () => {
                for (const file of clipboard!.paths) await operation(clipboard!.move ? 'move' : 'copy', file, { destination: listing!.path })
                setClipboard(undefined)
              })
            }
          >
            粘贴{clipboard ? ` (${clipboard.paths.length})` : ''}
          </ActionButton>
          <ActionButton quiet icon={Delete} label="移到废纸篓" disabled={!selected.length || busy} onClick={() => setDialog({ action: 'trash', value: '' })}>
            移到废纸篓
          </ActionButton>
          {current && selected.length === 1 && !current.directory && (
            <a className={actionButton.button} data-quiet title="下载" href={download(current.path) + `&name=${encodeURIComponent(current.name)}`}>
              <Download size="M" />
              <span className={actionButton.label}>下载</span>
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
        {error && <InlineAlert className={styles.error}>{error}</InlineAlert>}
        <div className={styles.content} aria-busy={loading || busy}>
          {loading ? (
            <div className={styles.empty}>
              <ProgressCircle size="M" label="正在读取" />
            </div>
          ) : entries.length === 0 ? (
            <div className={styles.empty}>
              <h2>{search ? '没有匹配的文件' : '此文件夹为空'}</h2>
              <p>{search ? '换个关键词试试。' : '上传文件或新建文件夹后会显示在这里。'}</p>
            </div>
          ) : (
            <div className={grid ? styles.grid : styles.table}>
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
                  type="button"
                  disabled={busy}
                  className={grid ? styles.tile : styles.entry}
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
                  {grid ? (
                    <>
                      <span className={styles.preview}>{entry.directory ? <Folder className={styles.bigIcon} /> : <File className={styles.bigIcon} />}</span>
                      <span className={styles.tileName}>
                        {entry.name}
                        {entry.symlink ? ' ↗' : ''}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className={styles.name}>
                        {entry.directory ? <Folder size="M" /> : <File size="M" />}
                        <span>
                          {entry.name}
                          {entry.symlink ? ' ↗' : ''}
                        </span>
                        {entry.directory && <UiIcon glyph="chevron" className={styles.chevron} />}
                      </span>
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
          item={{
            name: preview.name,
            path: preview.path,
            source: '本机文件',
            url: download(preview.path),
            downloadUrl: download(preview.path) + `&name=${encodeURIComponent(preview.name)}`,
            infoUrl: download(preview.path) + '&info=1',
          }}
          close={() => setPreview(undefined)}
        />
      )}
      {dialog && (
        <ModalHost
          className={styles.modal}
          label={dialog.action === 'trash' ? '移到废纸篓' : '输入名称'}
          dismissible={!busy}
          onClose={() => setDialog(undefined)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void run(async () => {
                if (dialog.action === 'trash') {
                  for (const file of selected) await operation('trash', file)
                } else await operation(dialog.action, dialog.action === 'mkdir' ? listing!.path : selected[0], { name: dialog.value })
              })
            }}
          >
            <header className={dialogStyles.header}>
              <h2 className={dialogStyles.heading}>
                {dialog.action === 'trash' ? `将 ${selected.length} 个项目移到废纸篓？` : dialog.action === 'mkdir' ? '新建文件夹' : '重命名'}
              </h2>
            </header>
            <div className={dialogStyles.content}>
              {dialog.action === 'trash' ? (
                <p className={styles.dialogText}>文件会移到 macOS 的废纸篓。</p>
              ) : (
                <input
                  className={field.textField}
                  autoFocus
                  aria-label="名称"
                  value={dialog.value}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setDialog({ ...dialog, value: e.target.value })}
                />
              )}
            </div>
            <div className={dialogStyles.footer}>
              <Button variant="secondary" fillStyle="outline" disabled={busy} onClick={() => setDialog(undefined)}>
                取消
              </Button>
              <Button
                type="submit"
                variant={dialog.action === 'trash' ? 'negative' : 'accent'}
                pending={busy}
                disabled={dialog.action !== 'trash' && !dialog.value.trim()}
              >
                {dialog.action === 'trash' ? '移到废纸篓' : '确认'}
              </Button>
            </div>
          </form>
        </ModalHost>
      )}
    </div>
  )
}

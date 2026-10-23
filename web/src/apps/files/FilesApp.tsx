import { ModalHost } from '../../shell/hosts/ModalHost.tsx'
import { Alert } from '../../ui/Alert.tsx'
import list from '../../ui/ActionList.module.css'
import { Blankslate } from '../../ui/Blankslate.tsx'
import { Button, LinkButton } from '../../ui/Button.tsx'
import { Checkbox } from '../../ui/Checkbox.tsx'
import dialogStyles from '../../ui/Dialog.module.css'
import { IconButton } from '../../ui/IconButton.tsx'
import { SegmentedControl } from '../../ui/SegmentedControl.tsx'
import { Select } from '../../ui/Select.tsx'
import { Spinner } from '../../ui/Spinner.tsx'
import { TextInput } from '../../ui/TextInput.tsx'
import { AppsIcon, ArrowLeftIcon, ArrowUpIcon, DatabaseIcon, DownloadIcon, FileDirectoryFillIcon, FileDirectoryIcon, FileIcon, HomeIcon, ListUnorderedIcon, SearchIcon, SyncIcon, TrashIcon, UploadIcon, XIcon } from '@primer/octicons-react'
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
    await request('/operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, path: file, ...extra }),
    })
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
        (sort === 'modified'
          ? b.modified - a.modified
          : sort === 'size'
            ? b.size - a.size
            : a.name.localeCompare(b.name, 'zh-CN', { numeric: true })),
    )
  const current = listing?.entries.find((e) => e.path === selected[0])
  const download = (file: string) => `${base}/download?${new URLSearchParams({ path: file })}`
  function select(entry: Entry, multi: boolean) {
    setSelected((old) => (multi ? (old.includes(entry.path) ? old.filter((p) => p !== entry.path) : [...old, entry.path]) : [entry.path]))
  }
  return (
    <div className={styles.app}>
      <aside className={styles.sidebar}>
        <nav className={list.list} aria-label="位置">
          <h2 className={list.heading}>个人收藏</h2>
          {listing &&
            ([
              ['个人目录', listing.home, HomeIcon],
              ['桌面', listing.home + '/Desktop', FileDirectoryIcon],
              ['文稿', listing.home + '/Documents', FileDirectoryIcon],
              ['下载', listing.home + '/Downloads', DownloadIcon],
              ['图片', listing.home + '/Pictures', FileDirectoryIcon],
            ] as const).map(([label, dir, Icon]) => (
              <button key={dir} type="button" className={list.item} aria-current={listing.path === dir ? 'page' : undefined} disabled={busy} onClick={() => go(dir)}>
                <span className={list.visual}><Icon size={16} /></span>
                <span className={list.label}>{label}</span>
              </button>
            ))}
          <hr className={list.divider} />
          <h2 className={list.heading}>位置</h2>
          <button type="button" className={list.item} aria-current={listing?.path === '/' ? 'page' : undefined} disabled={busy} onClick={() => go('/')}>
            <span className={list.visual}><DatabaseIcon size={16} /></span>
            <span className={list.label}>Macintosh HD</span>
          </button>
          <button type="button" className={list.item} aria-current={listing?.path === '/Volumes' ? 'page' : undefined} disabled={busy} onClick={() => go('/Volumes')}>
            <span className={list.visual}><FileDirectoryIcon size={16} /></span>
            <span className={list.label}>外置磁盘</span>
          </button>
          {listing && (
            <button type="button" className={list.item} aria-current={listing.path === listing.home + '/.Trash' ? 'page' : undefined} disabled={busy} onClick={() => go(listing.home + '/.Trash')}>
              <span className={list.visual}><TrashIcon size={16} /></span>
              <span className={list.label}>废纸篓</span>
            </button>
          )}
        </nav>
      </aside>
      <main className={styles.main}>
        <header className={styles.toolbar}>
          <IconButton icon={ArrowLeftIcon} label="后退" disabled={busy} onClick={ctx.back} />
          <IconButton icon={ArrowUpIcon} label="上一级" disabled={busy || !listing || listing.parent === listing.path} onClick={() => listing && go(listing.parent)} />
          <form
            className={styles.path}
            onSubmit={(e) => {
              e.preventDefault()
              go(location)
            }}
          >
            <TextInput
              block
              leadingVisual={FileDirectoryIcon}
              className={styles.pathInput}
              aria-label="文件夹路径"
              disabled={busy}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="输入绝对路径"
            />
          </form>
          <IconButton icon={SyncIcon} label="刷新" disabled={loading || busy} onClick={() => void load(route)} />
          <SegmentedControl
            label="切换视图"
            value={grid ? 'grid' : 'list'}
            onChange={(view) => setGrid(view === 'grid')}
            segments={[
              { value: 'list', label: '', icon: ListUnorderedIcon, ariaLabel: '列表视图' },
              { value: 'grid', label: '', icon: AppsIcon, ariaLabel: '图标视图' },
            ]}
          />
        </header>
        <div className={styles.controls}>
          <TextInput
            className={styles.search}
            leadingVisual={SearchIcon}
            aria-label="搜索当前文件夹"
            placeholder="搜索当前文件夹"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            label="排序"
            size="medium"
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
          <Button size="small" leadingVisual={FileDirectoryIcon} disabled={busy || !listing || loading} onClick={() => setDialog({ action: 'mkdir', value: '未命名文件夹' })}>
            新建文件夹
          </Button>
          <Button size="small" leadingVisual={UploadIcon} disabled={busy || !listing || loading} onClick={() => upload.current?.click()}>
            上传
          </Button>
          <span className={styles.divider} />
          <Button
            size="small"
            disabled={busy || selected.length !== 1}
            onClick={() => current && (current.directory ? go(current.path) : setPreview(current))}
          >
            打开
          </Button>
          <Button size="small" disabled={busy || selected.length !== 1} onClick={() => setDialog({ action: 'rename', value: current?.name || '' })}>
            重命名
          </Button>
          <Button size="small" disabled={!selected.length || busy} onClick={() => setClipboard({ paths: selected, move: false })}>
            复制
          </Button>
          <Button size="small" disabled={!selected.length || busy} onClick={() => setClipboard({ paths: selected, move: true })}>
            剪切
          </Button>
          <Button
            size="small"
            disabled={!clipboard || busy || !listing || loading}
            onClick={() =>
              void run(async () => {
                for (const file of clipboard!.paths)
                  await operation(clipboard!.move ? 'move' : 'copy', file, { destination: listing!.path })
                setClipboard(undefined)
              })
            }
          >
            粘贴{clipboard ? ` (${clipboard.paths.length})` : ''}
          </Button>
          {current && selected.length === 1 && !current.directory && (
            <LinkButton size="small" leadingVisual={DownloadIcon} href={download(current.path) + `&name=${encodeURIComponent(current.name)}`}>
              下载
            </LinkButton>
          )}
          <Button size="small" variant="danger" leadingVisual={TrashIcon} disabled={!selected.length || busy} onClick={() => setDialog({ action: 'trash', value: '' })}>
            移到废纸篓
          </Button>
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
        {error && <Alert className={styles.error}>{error}</Alert>}
        <div className={styles.content} aria-busy={loading || busy}>
          <div className={styles.box}>
            <div className={styles.boxHeader}>
              <nav className={styles.breadcrumbs} aria-label="路径">
                {listing && crumbs(listing.path).map((crumb, index, all) => index === all.length - 1
                  ? <strong key={crumb.path} aria-current="page">{crumb.name}</strong>
                  : <span key={crumb.path}>{crumb.name}<span aria-hidden>/</span></span>)}
              </nav>
              {loading && <Spinner />}
            </div>
            {loading ? (
              <Blankslate size="narrow" visual={<Spinner size="medium" />} description="正在读取…" />
            ) : entries.length === 0 ? (
              <Blankslate size="narrow" icon={search ? SearchIcon : FileDirectoryIcon} heading={search ? '没有匹配的文件' : '此文件夹为空'} />
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
                    type="button"
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
                      {entry.directory ? <FileDirectoryFillIcon className={styles.folder} size={grid ? 32 : 16} /> : <FileIcon className={styles.file} size={grid ? 32 : 16} />}
                      <span>
                        {entry.name}
                        {entry.symlink ? ' ↗' : ''}
                      </span>
                    </span>
                    {!grid && (
                      <>
                        <span className={styles.meta}>
                          {entry.modified
                            ? new Date(entry.modified).toLocaleString('zh-CN', { dateStyle: 'short', timeStyle: 'short' })
                            : '—'}
                        </span>
                        <span className={styles.meta}>{entry.directory ? '—' : size(entry.size)}</span>
                      </>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
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
          className={dialogStyles.dialog}
          label={dialog.action === 'trash' ? '移到废纸篓' : '输入名称'}
          dismissible={!busy}
          onClose={() => setDialog(undefined)}
        >
          <form
            className={styles.dialogForm}
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
              <div className={dialogStyles.titles}>
                <h2 className={dialogStyles.title}>
                  {dialog.action === 'trash' ? `将 ${selected.length} 个项目移到废纸篓？` : dialog.action === 'mkdir' ? '新建文件夹' : '重命名'}
                </h2>
              </div>
              <IconButton icon={XIcon} label="关闭" disabled={busy} onClick={() => setDialog(undefined)} />
            </header>
            <div className={dialogStyles.body}>
              {dialog.action === 'trash' ? (
                <p className={styles.dialogText}>文件会移到 macOS 的废纸篓。</p>
              ) : (
                <TextInput
                  block
                  autoFocus
                  aria-label="名称"
                  value={dialog.value}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setDialog({ ...dialog, value: e.target.value })}
                />
              )}
            </div>
            <footer className={dialogStyles.footer}>
              <Button disabled={busy} onClick={() => setDialog(undefined)}>
                取消
              </Button>
              <Button type="submit" variant={dialog.action === 'trash' ? 'danger' : 'primary'} disabled={busy || (dialog.action !== 'trash' && !dialog.value.trim())}>
                {dialog.action === 'trash' ? '移到废纸篓' : '确认'}
              </Button>
            </footer>
          </form>
        </ModalHost>
      )}
    </div>
  )
}

// 面包屑：从根目录到当前文件夹的每一级
function crumbs(path: string) {
  const parts = path.split('/').filter(Boolean)
  return [{ name: 'Macintosh HD', path: '/' }, ...parts.map((name, index) => ({ name, path: '/' + parts.slice(0, index + 1).join('/') }))]
}

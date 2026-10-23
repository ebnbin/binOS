import type { FluentIcon } from '@fluentui/react-icons/headless'
import { ArrowClockwiseRegular } from '@fluentui/react-icons/headless/svg/arrow-clockwise'
import { ArrowDownloadRegular } from '@fluentui/react-icons/headless/svg/arrow-download'
import { ArrowLeftRegular } from '@fluentui/react-icons/headless/svg/arrow-left'
import { ArrowUpRegular } from '@fluentui/react-icons/headless/svg/arrow-up'
import { ArrowUploadRegular } from '@fluentui/react-icons/headless/svg/arrow-upload'
import { ChevronRightRegular } from '@fluentui/react-icons/headless/svg/chevron-right'
import { ClipboardPasteRegular } from '@fluentui/react-icons/headless/svg/clipboard-paste'
import { CopyRegular } from '@fluentui/react-icons/headless/svg/copy'
import { CutRegular } from '@fluentui/react-icons/headless/svg/cut'
import { DeleteRegular } from '@fluentui/react-icons/headless/svg/delete'
import { DesktopRegular } from '@fluentui/react-icons/headless/svg/desktop'
import { DocumentRegular } from '@fluentui/react-icons/headless/svg/document'
import { FolderFilled, FolderRegular } from '@fluentui/react-icons/headless/svg/folder'
import { FolderAddRegular } from '@fluentui/react-icons/headless/svg/folder-add'
import { GridRegular } from '@fluentui/react-icons/headless/svg/grid'
import { HardDriveRegular } from '@fluentui/react-icons/headless/svg/hard-drive'
import { HomeRegular } from '@fluentui/react-icons/headless/svg/home'
import { ImageRegular } from '@fluentui/react-icons/headless/svg/image'
import { ListRegular } from '@fluentui/react-icons/headless/svg/list'
import { OpenRegular } from '@fluentui/react-icons/headless/svg/open'
import { RenameRegular } from '@fluentui/react-icons/headless/svg/rename'
import { SearchRegular } from '@fluentui/react-icons/headless/svg/search'
import { StorageRegular } from '@fluentui/react-icons/headless/svg/storage'
import { ModalHost } from '../../shell/hosts/ModalHost.tsx'
import { Alert } from '../../ui/Alert.tsx'
import { Button } from '../../ui/Button.tsx'
import { Checkbox } from '../../ui/Checkbox.tsx'
import dialogStyles from '../../ui/Dialog.module.css'
import { IconButton } from '../../ui/IconButton.tsx'
import { Input } from '../../ui/Input.tsx'
import { Select } from '../../ui/Select.tsx'
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
        <div className={styles.caption}>个人收藏</div>
        {listing &&
          ([
            ['个人目录', listing.home, HomeRegular],
            ['桌面', listing.home + '/Desktop', DesktopRegular],
            ['文稿', listing.home + '/Documents', DocumentRegular],
            ['下载', listing.home + '/Downloads', ArrowDownloadRegular],
            ['图片', listing.home + '/Pictures', ImageRegular],
          ] as [string, string, FluentIcon][]).map(([label, dir, Icon]) => (
            <button key={dir} className={styles.place} data-selected={listing.path === dir} disabled={busy} onClick={() => go(dir)}>
              <Icon />
              {label}
            </button>
          ))}
        <div className={styles.caption}>位置</div>
        <button className={styles.place} data-selected={listing?.path === '/'} disabled={busy} onClick={() => go('/')}>
          <HardDriveRegular />
          Macintosh HD
        </button>
        <button className={styles.place} data-selected={listing?.path === '/Volumes'} disabled={busy} onClick={() => go('/Volumes')}>
          <StorageRegular />
          外置磁盘
        </button>
        {listing && (
          <button className={styles.place} data-selected={listing.path === listing.home + '/.Trash'} disabled={busy} onClick={() => go(listing.home + '/.Trash')}>
            <DeleteRegular />
            废纸篓
          </button>
        )}
      </aside>
      <main className={styles.main}>
        <header className={styles.toolbar}>
          <IconButton icon={<ArrowLeftRegular />} label="后退" disabled={busy} onClick={ctx.back} />
          <IconButton icon={<ArrowUpRegular />} label="上一级" disabled={busy || !listing || listing.parent === listing.path} onClick={() => listing && go(listing.parent)} />
          <IconButton icon={<ArrowClockwiseRegular />} label="刷新" disabled={loading || busy} onClick={() => void load(route)} />
          <form
            className={styles.path}
            onSubmit={(e) => {
              e.preventDefault()
              go(location)
            }}
          >
            <Input
              className={styles.pathInput}
              contentBefore={<FolderRegular />}
              aria-label="文件夹路径"
              disabled={busy}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="输入绝对路径"
            />
          </form>
          <Input
            className={styles.search}
            contentBefore={<SearchRegular />}
            aria-label="搜索当前文件夹"
            placeholder="搜索当前文件夹"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </header>
        <div className={styles.actions}>
          <Button className={styles.command} appearance="subtle" icon={<FolderAddRegular />} disabled={busy || !listing || loading} onClick={() => setDialog({ action: 'mkdir', value: '未命名文件夹' })}>
            <span className={styles.commandLabel}>新建文件夹</span>
          </Button>
          <Button className={styles.command} appearance="subtle" icon={<ArrowUploadRegular />} disabled={busy || !listing || loading} onClick={() => upload.current?.click()}>
            <span className={styles.commandLabel}>上传</span>
          </Button>
          <span className={styles.commandDivider} />
          <Button
            className={styles.command}
            appearance="subtle"
            icon={<OpenRegular />}
            disabled={busy || selected.length !== 1}
            onClick={() => current && (current.directory ? go(current.path) : setPreview(current))}
          >
            <span className={styles.commandLabel}>打开</span>
          </Button>
          <Button className={styles.command} appearance="subtle" icon={<RenameRegular />} disabled={busy || selected.length !== 1} onClick={() => setDialog({ action: 'rename', value: current?.name || '' })}>
            <span className={styles.commandLabel}>重命名</span>
          </Button>
          <Button className={styles.command} appearance="subtle" icon={<CopyRegular />} disabled={!selected.length || busy} onClick={() => setClipboard({ paths: selected, move: false })}>
            <span className={styles.commandLabel}>复制</span>
          </Button>
          <Button className={styles.command} appearance="subtle" icon={<CutRegular />} disabled={!selected.length || busy} onClick={() => setClipboard({ paths: selected, move: true })}>
            <span className={styles.commandLabel}>剪切</span>
          </Button>
          <Button
            className={styles.command}
            appearance="subtle"
            icon={<ClipboardPasteRegular />}
            disabled={!clipboard || busy || !listing || loading}
            onClick={() =>
              void run(async () => {
                for (const file of clipboard!.paths)
                  await operation(clipboard!.move ? 'move' : 'copy', file, { destination: listing!.path })
                setClipboard(undefined)
              })
            }
          >
            <span className={styles.commandLabel}>粘贴{clipboard ? ` (${clipboard.paths.length})` : ''}</span>
          </Button>
          <Button className={styles.command} appearance="subtle" icon={<DeleteRegular />} disabled={!selected.length || busy} onClick={() => setDialog({ action: 'trash', value: '' })}>
            <span className={styles.commandLabel}>移到废纸篓</span>
          </Button>
          {current && selected.length === 1 && !current.directory && (
            <a className={styles.download} href={download(current.path) + `&name=${encodeURIComponent(current.name)}`}>
              <ArrowDownloadRegular />
              <span className={styles.commandLabel}>下载</span>
            </a>
          )}
          <span className={styles.commandDivider} />
          <Select
            size="small"
            appearance="subtle"
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
          <IconButton icon={grid ? <ListRegular /> : <GridRegular />} label={grid ? '列表视图' : '图标视图'} aria-label="切换视图" onClick={() => setGrid(!grid)} />
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
                  className={styles.entry}
                  data-selected={selected.includes(entry.path)}
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
                    {entry.directory ? <FolderFilled className={styles.folder} /> : <DocumentRegular className={styles.file} />}
                    <span>
                      {entry.name}
                      {entry.symlink ? ' ↗' : ''}
                    </span>
                    {entry.directory && !grid && <ChevronRightRegular className={styles.chevron} />}
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
          label={dialog.action === 'trash' ? '移到废纸篓' : '输入名称'}
          dismissible={!busy}
          onClose={() => setDialog(undefined)}
        >
          <form
            className={dialogStyles.body}
            onSubmit={(e) => {
              e.preventDefault()
              void run(async () => {
                if (dialog.action === 'trash') {
                  for (const file of selected) await operation('trash', file)
                } else await operation(dialog.action, dialog.action === 'mkdir' ? listing!.path : selected[0], { name: dialog.value })
              })
            }}
          >
            <h2 className={dialogStyles.title}>
              {dialog.action === 'trash' ? `将 ${selected.length} 个项目移到废纸篓？` : dialog.action === 'mkdir' ? '新建文件夹' : '重命名'}
            </h2>
            {dialog.action === 'trash' ? (
              <p className={dialogStyles.content}>文件会移到 macOS 的废纸篓。</p>
            ) : (
              <Input
                autoFocus
                aria-label="名称"
                value={dialog.value}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setDialog({ ...dialog, value: e.target.value })}
              />
            )}
            <div className={dialogStyles.actions}>
              <Button disabled={busy} onClick={() => setDialog(undefined)}>
                取消
              </Button>
              <Button type="submit" appearance="primary" disabled={busy || (dialog.action !== 'trash' && !dialog.value.trim())}>确认</Button>
            </div>
          </form>
        </ModalHost>
      )}
    </div>
  )
}

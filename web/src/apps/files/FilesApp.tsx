import { Button, Flex, Heading, Text, TextField } from '@radix-ui/themes'
import { ModalHost } from '../../shell/hosts/ModalHost.tsx'
import { Alert } from '../../ui/Alert.tsx'
import { Checkbox } from '../../ui/Checkbox.tsx'
import { IconButton } from '../../ui/IconButton.tsx'
import {
  ArrowLeftIcon,
  ArrowUpIcon,
  ChevronRightIcon,
  ClipboardIcon,
  CopyIcon,
  DownloadIcon,
  EnterIcon,
  FileIcon,
  FolderIcon,
  HardDriveIcon,
  HomeIcon,
  ListBulletIcon,
  MagnifyingGlassIcon,
  Pencil1Icon,
  PlusIcon,
  ReloadIcon,
  ScissorsIcon,
  TrashIcon,
  UploadIcon,
  ViewGridIcon,
} from '../../ui/icons.ts'
import type { Icon } from '../../ui/icons.ts'
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
  const place = (label: string, dir: string, Glyph: Icon) => (
    <button key={dir} className={listing?.path === dir ? styles.active : ''} disabled={busy} onClick={() => go(dir)}>
      <Glyph />
      {label}
    </button>
  )
  return (
    <div className={styles.app}>
      <aside className={styles.sidebar}>
        <div className={styles.caption}>个人收藏</div>
        {listing &&
          (
            [
              ['个人目录', listing.home, HomeIcon],
              ['桌面', listing.home + '/Desktop', FolderIcon],
              ['文稿', listing.home + '/Documents', FolderIcon],
              ['下载', listing.home + '/Downloads', FolderIcon],
              ['图片', listing.home + '/Pictures', FolderIcon],
            ] as const
          ).map(([label, dir, glyph]) => place(label, dir, glyph))}
        <div className={styles.caption}>位置</div>
        {place('Macintosh HD', '/', HardDriveIcon)}
        {place('外置磁盘', '/Volumes', HardDriveIcon)}
        {listing && place('废纸篓', listing.home + '/.Trash', TrashIcon)}
      </aside>
      <main className={styles.main}>
        <header className={styles.toolbar}>
          <IconButton icon={ArrowLeftIcon} label="后退" disabled={busy} onClick={ctx.back} />
          <IconButton
            icon={ArrowUpIcon}
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
            <TextField.Root
              className={styles.pathField}
              aria-label="文件夹路径"
              disabled={busy}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="输入绝对路径"
              spellCheck={false}
            />
          </form>
          <IconButton icon={ReloadIcon} label="刷新" disabled={loading || busy} onClick={() => void load(route)} />
          <IconButton icon={grid ? ListBulletIcon : ViewGridIcon} label="切换视图" title={grid ? '列表视图' : '图标视图'} onClick={() => setGrid(!grid)} />
        </header>
        <div className={styles.controls}>
          <TextField.Root
            className={styles.search}
            aria-label="搜索当前文件夹"
            placeholder="搜索当前文件夹"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          >
            <TextField.Slot>
              <MagnifyingGlassIcon />
            </TextField.Slot>
          </TextField.Root>
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
          <Button variant="ghost" color="gray" disabled={busy || !listing || loading} onClick={() => setDialog({ action: 'mkdir', value: '未命名文件夹' })}>
            <PlusIcon />
            新建文件夹
          </Button>
          <Button variant="ghost" color="gray" disabled={busy || !listing || loading} onClick={() => upload.current?.click()}>
            <UploadIcon />
            上传
          </Button>
          <Button
            variant="ghost"
            color="gray"
            disabled={busy || selected.length !== 1}
            onClick={() => current && (current.directory ? go(current.path) : setPreview(current))}
          >
            <EnterIcon />
            打开
          </Button>
          <Button variant="ghost" color="gray" disabled={busy || selected.length !== 1} onClick={() => setDialog({ action: 'rename', value: current?.name || '' })}>
            <Pencil1Icon />
            重命名
          </Button>
          <Button variant="ghost" color="gray" disabled={!selected.length || busy} onClick={() => setClipboard({ paths: selected, move: false })}>
            <CopyIcon />
            复制
          </Button>
          <Button variant="ghost" color="gray" disabled={!selected.length || busy} onClick={() => setClipboard({ paths: selected, move: true })}>
            <ScissorsIcon />
            剪切
          </Button>
          <Button
            variant="ghost"
            color="gray"
            disabled={!clipboard || busy || !listing || loading}
            onClick={() =>
              void run(async () => {
                for (const file of clipboard!.paths)
                  await operation(clipboard!.move ? 'move' : 'copy', file, { destination: listing!.path })
                setClipboard(undefined)
              })
            }
          >
            <ClipboardIcon />
            粘贴{clipboard ? ` (${clipboard.paths.length})` : ''}
          </Button>
          <Button variant="ghost" color="gray" disabled={!selected.length || busy} onClick={() => setDialog({ action: 'trash', value: '' })}>
            <TrashIcon />
            移到废纸篓
          </Button>
          {current && selected.length === 1 && !current.directory && (
            <Button asChild variant="ghost" color="gray">
              <a href={download(current.path) + `&name=${encodeURIComponent(current.name)}`}>
                <DownloadIcon />
                下载
              </a>
            </Button>
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
          <div className={styles.error}>
            <Alert>{error}</Alert>
          </div>
        )}
        <div className={styles.content} aria-busy={loading || busy}>
          {loading ? (
            <Text as="p" size="2" color="gray" className={styles.empty}>
              正在读取…
            </Text>
          ) : entries.length === 0 ? (
            <Text as="p" size="2" color="gray" className={styles.empty}>
              {search ? '没有匹配的文件' : '此文件夹为空'}
            </Text>
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
                    {entry.directory ? (
                      <FolderIcon className={styles.icon} width={grid ? 40 : 15} height={grid ? 40 : 15} />
                    ) : (
                      <FileIcon className={styles.icon} width={grid ? 40 : 15} height={grid ? 40 : 15} />
                    )}
                    <span>
                      {entry.name}
                      {entry.symlink ? ' ↗' : ''}
                    </span>
                    {entry.directory && !grid && <ChevronRightIcon className={styles.chevron} />}
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
          maxWidth="450px"
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
            <Heading as="h2" size="5" mb="3" trim="start">
              {dialog.action === 'trash' ? `将 ${selected.length} 个项目移到废纸篓？` : dialog.action === 'mkdir' ? '新建文件夹' : '重命名'}
            </Heading>
            {dialog.action === 'trash' ? (
              <Text as="p" size="2" color="gray">
                文件会移到 macOS 的废纸篓。
              </Text>
            ) : (
              <TextField.Root
                autoFocus
                aria-label="名称"
                value={dialog.value}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setDialog({ ...dialog, value: e.target.value })}
              />
            )}
            <Flex gap="3" mt="4" justify="end">
              <Button type="button" variant="soft" color="gray" disabled={busy} onClick={() => setDialog(undefined)}>
                取消
              </Button>
              <Button type="submit" color={dialog.action === 'trash' ? 'red' : undefined} disabled={busy || (dialog.action !== 'trash' && !dialog.value.trim())}>
                {dialog.action === 'trash' ? '移到废纸篓' : '确认'}
              </Button>
            </Flex>
          </form>
        </ModalHost>
      )}
    </div>
  )
}

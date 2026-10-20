import { Download, Expand, File, Info, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { threadFileUrl } from '../../services/agent/api.ts'
import { CodeBlock } from '../../services/agent/thread/CodeBlock.tsx'
import { HtmlFrame } from '../../services/agent/thread/HtmlFrame.tsx'
import { Markdown } from '../../services/agent/thread/Markdown.tsx'
import { languageOf } from '../../services/agent/thread/highlight.ts'
import styles from './FileBlock.module.css'

export type SavedFile = { thread: string; file: string; name: string; path?: string; url?: string }
type Metadata = { size: number; modified: string; type: string }
const extension = (name: string) => name.split('.').at(-1)?.toLowerCase() ?? ''
function kind(name: string) {
  const ext = extension(name)
  if (/^(png|jpe?g|gif|webp|avif|bmp|svg)$/.test(ext)) return 'image'
  if (/^(mp4|webm|mov|m4v)$/.test(ext)) return 'video'
  if (/^(mp3|wav|ogg|m4a|flac)$/.test(ext)) return 'audio'
  if (/^(html|htm)$/.test(ext)) return 'html'
  if (ext === 'pdf') return 'pdf'
  if (/^(md|markdown)$/.test(ext)) return 'markdown'
  if (/^(txt|log|csv|tsv|json|jsonl|xml|yaml|yml|toml|ini|cfg|conf|env|js|jsx|ts|tsx|mjs|cjs|mts|cts|css|scss|less|py|rb|rs|go|java|kt|swift|c|cpp|h|hpp|sh|bash|zsh|sql|vue|svelte|tex|r|patch|diff)$/.test(ext) || /^(dockerfile|makefile|license|readme|\.gitignore)$/i.test(name)) return 'text'
  return 'binary'
}
function sizeLabel(size: number) {
  return size < 1024 ? `${size} B` : size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`
}

function fileUrl(item: SavedFile, download = false) {
  if (item.url) return item.url + (download ? `&name=${encodeURIComponent(item.name)}` : '')
  return threadFileUrl(item.thread, item.file, download ? item.name : undefined)
}

function Preview({ item, type, source }: { item: SavedFile; type: string; source: boolean }) {
  const [text, setText] = useState<string>()
  const [error, setError] = useState('')
  const url = fileUrl(item)
  useEffect(() => {
    if (!['text', 'markdown', 'html'].includes(type)) return
    const controller = new AbortController()
    void (async () => {
      try {
        const response = await fetch(url, { signal: controller.signal, headers: { Range: 'bytes=0-1048576' } })
        if (!response.ok) throw new Error('文件加载失败')
        const content = await response.text()
        if (content.length > 1_048_576 || Number(response.headers.get('Content-Range')?.split('/')[1] ?? response.headers.get('Content-Length')) > 1_048_576) {
          throw new Error('文件超过 1 MB 预览上限，请下载查看')
        }
        setText(content)
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : '文件加载失败')
      }
    })()
    return () => controller.abort()
  }, [url, type])
  if (error) return <div className={styles.status}>{error}</div>
  if (type === 'image') return <img className={styles.image} src={url} alt={item.name} onError={() => setError('此图片无法预览，请下载查看')} />
  if (type === 'video') return <video className={styles.media} controls src={url} onError={() => setError('此视频无法在浏览器中播放，请下载查看')} />
  if (type === 'audio') return <audio className={styles.media} controls src={url} onError={() => setError('此音频无法在浏览器中播放，请下载查看')} />
  if (type === 'pdf') return <iframe className={styles.document} title={item.name} src={url} />
  if (type === 'binary') return <div className={styles.status}><File size={48} strokeWidth={1} /><strong>{item.name}</strong><span>此文件暂不支持预览</span><span>可以下载原文件或查看文件信息</span></div>
  if (text === undefined) return <div className={styles.status}>加载中…</div>
  if (type === 'html' && !source) return <iframe className={styles.document} title={item.name} sandbox="allow-scripts" srcDoc={text} />
  if (type === 'markdown' && !source) return <div className={styles.prose}><Markdown thread={item.thread} text={text} /></div>
  return <div className={styles.code}><CodeBlock code={text} lang={languageOf(item.name)} startLine={1} label={item.name} /></div>
}

export function FilePreview({ item, close }: { item: SavedFile; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [info, setInfo] = useState(false)
  const [source, setSource] = useState(false)
  const [metadata, setMetadata] = useState<Metadata>()
  const [error, setError] = useState(false)
  const type = kind(item.name)
  const url = fileUrl(item)
  useEffect(() => {
    dialog.current?.showModal()
    const controller = new AbortController()
    fetch(url + (url.includes('?') ? '&' : '?') + 'info=1', { signal: controller.signal })
      .then(async (res) => { if (!res.ok) throw new Error(); setMetadata(await res.json() as Metadata) })
      .catch(() => { if (!controller.signal.aborted) setError(true) })
    return () => controller.abort()
  }, [url])
  return createPortal(
    <dialog ref={dialog} className={styles.dialog} onClose={close} onClick={(event) => { if (event.target === dialog.current) close() }} aria-label={item.name}>
      <div className={styles.window}>
        <header className={styles.toolbar}>
          <File size={18} /><strong className={styles.title}>{item.name}</strong>
          {['markdown', 'html'].includes(type) && <button type="button" onClick={() => setSource(!source)}>{source ? '预览' : '源码'}</button>}
          <a href={fileUrl(item, true)} download={item.name} title="下载"><Download size={17} /><span>下载</span></a>
          <button type="button" onClick={() => setInfo(!info)} aria-label="文件信息" aria-pressed={info}><Info size={17} /></button>
          <button type="button" onClick={close} aria-label="关闭预览" autoFocus><X size={19} /></button>
        </header>
        <div className={styles.body}>
          <main className={styles.preview}><Preview item={item} type={type} source={source} /></main>
          {info && <aside className={styles.info}><h3>文件信息</h3><dl>
            <dt>名称</dt><dd>{item.name}</dd>
            <dt>类型</dt><dd>{extension(item.name).toUpperCase() || '文件'}{metadata && <small>{metadata.type}</small>}</dd>
            <dt>大小</dt><dd>{metadata ? `${sizeLabel(metadata.size)}（${metadata.size.toLocaleString()} 字节）` : error ? '读取失败' : '加载中…'}</dd>
            <dt>修改时间</dt><dd>{metadata ? new Date(metadata.modified).toLocaleString() : '—'}</dd>
            <dt>来源</dt><dd>{item.url ? '本机文件' : '会话文件'}</dd>
            {item.path && <><dt>原始路径</dt><dd>{item.path}</dd></>}
          </dl></aside>}
        </div>
      </div>
    </dialog>, document.body,
  )
}

export function FileBlock({ thread, file, name, path, embedded = false }: SavedFile & { embedded?: boolean }) {
  const [open, setOpen] = useState(false)
  const [broken, setBroken] = useState(false)
  const type = kind(name)
  return <span className={styles.block}>
    <span className={styles.bar}>
      <File size={16} /><span className={styles.title} title={name}>{name}</span>
      <span className={styles.badge}>{extension(name).toUpperCase() || 'FILE'}</span>
      <button type="button" onClick={() => setOpen(true)} title="打开预览" aria-label={`预览 ${name}`}><Expand size={15} /></button>
      <a href={threadFileUrl(thread, file, name)} download={name} title="下载" aria-label={`下载 ${name}`}><Download size={15} /></a>
    </span>
    {type === 'image' && !broken ? <button type="button" className={styles.thumbnail} onClick={() => setOpen(true)}><img src={threadFileUrl(thread, file)} alt={name} loading="lazy" onError={() => setBroken(true)} /></button>
      : embedded && type === 'html' ? <HtmlFrame thread={thread} file={file} title={name} />
      : <button type="button" className={styles.summary} onClick={() => setOpen(true)}><File size={24} strokeWidth={1.25} /><span>{name}<small>{type === 'binary' ? '查看信息或下载原文件' : '打开文件预览'}</small></span><Expand size={16} /></button>}
    {open && <FilePreview item={{ thread, file, name, path }} close={() => setOpen(false)} />}
  </span>
}

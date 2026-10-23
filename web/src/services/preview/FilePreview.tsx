import { useEffect, useState } from 'react'
import { ModalHost } from '../../shell/hosts/ModalHost.tsx'
import action from '../../ui/ActionButton.module.css'
import { ActionButton } from '../../ui/ActionButton.tsx'
import { CloseButton } from '../../ui/CloseButton.tsx'
import { Download, File, InfoCircle } from '../../ui/icons.tsx'
import { ProgressCircle } from '../../ui/ProgressCircle.tsx'
import segmented from '../../ui/SegmentedControl.module.css'
import { CodeBlock } from '../../ui/content/CodeBlock.tsx'
import { Markdown } from '../../ui/content/Markdown.tsx'
import { languageOf } from '../../ui/content/highlight.ts'
import styles from './FileBlock.module.css'

import { extension, kind } from './kind.ts'
import type { PreviewFile } from './types.ts'
type Metadata = { size: number; modified: string; type: string }
function sizeLabel(size: number) {
  return size < 1024 ? `${size} B` : size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`
}

function Preview({ item, type, source }: { item: PreviewFile; type: string; source: boolean }) {
  const [text, setText] = useState<string>()
  const [error, setError] = useState('')
  const url = item.url
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
  if (type === 'binary') return <div className={styles.status}><File className={styles.statusIcon} /><strong>{item.name}</strong><span>此文件暂不支持预览</span><span>可以下载原文件或查看文件信息</span></div>
  if (text === undefined) return <div className={styles.status}><ProgressCircle size="M" label="加载中" /></div>
  if (type === 'html' && !source) return <iframe className={styles.document} title={item.name} sandbox="allow-scripts" srcDoc={text} />
  if (type === 'markdown' && !source) return <div className={styles.prose}><Markdown text={text} /></div>
  return <div className={styles.code}><CodeBlock code={text} lang={languageOf(item.name)} startLine={1} label={item.name} /></div>
}

export function FilePreview(props: { item: PreviewFile; close: () => void }) {
  return <PreviewDialog key={props.item.url + '\0' + props.item.name} {...props} />
}

function PreviewDialog({ item, close }: { item: PreviewFile; close: () => void }) {
  const [info, setInfo] = useState(false)
  const [source, setSource] = useState(false)
  const [metadata, setMetadata] = useState<Metadata>()
  const [error, setError] = useState(false)
  const type = kind(item.name)
  useEffect(() => {
    if (!item.infoUrl) return
    const controller = new AbortController()
    fetch(item.infoUrl, { signal: controller.signal })
      .then(async (res) => { if (!res.ok) throw new Error(); setMetadata(await res.json() as Metadata) })
      .catch(() => { if (!controller.signal.aborted) setError(true) })
    return () => controller.abort()
  }, [item.infoUrl])
  return (
    <ModalHost className={styles.dialog} onClose={close} label={item.name}>
      <div className={styles.window}>
        <header className={styles.toolbar}>
          <File className={styles.fileIcon} /><h2 className={styles.heading}>{item.name}</h2>
          {['markdown', 'html'].includes(type) && (
            <div className={segmented.control} role="group" aria-label="显示方式">
              <button type="button" className={segmented.item} aria-pressed={!source} onClick={() => setSource(false)}>预览</button>
              <button type="button" className={segmented.item} aria-pressed={source} onClick={() => setSource(true)}>源码</button>
            </div>
          )}
          <a className={`${action.button} ${styles.download}`} data-quiet href={item.downloadUrl ?? item.url} download={item.name} title="下载"><Download size="M" /><span className={action.label}>下载</span></a>
          <ActionButton quiet icon={InfoCircle} label="文件信息" selected={info} onClick={() => setInfo(!info)} />
          <CloseButton label="关闭预览" onClick={close} autoFocus />
        </header>
        <div className={styles.body}>
          <main className={styles.preview}><Preview item={item} type={type} source={source} /></main>
          {info && <aside className={styles.info}><h3>文件信息</h3><dl>
            <dt>名称</dt><dd>{item.name}</dd>
            <dt>类型</dt><dd>{extension(item.name).toUpperCase() || '文件'}{metadata && <small>{metadata.type}</small>}</dd>
            <dt>大小</dt><dd>{metadata ? `${sizeLabel(metadata.size)}（${metadata.size.toLocaleString()} 字节）` : !item.infoUrl ? '—' : error ? '读取失败' : '加载中…'}</dd>
            <dt>修改时间</dt><dd>{metadata ? new Date(metadata.modified).toLocaleString() : '—'}</dd>
            <dt>来源</dt><dd>{item.source ?? '—'}</dd>
            {item.path && <><dt>原始路径</dt><dd>{item.path}</dd></>}
          </dl></aside>}
        </div>
      </div>
    </ModalHost>
  )
}


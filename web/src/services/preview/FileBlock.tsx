import { Download, Expand, File } from '../../ui/icons'
import { useState } from 'react'
import { FilePreview } from './FilePreview.tsx'
import { HtmlFrame } from './HtmlFrame.tsx'
import { extension, kind } from './kind.ts'
import type { PreviewFile } from './types.ts'
import styles from './FileBlock.module.css'

export function FileBlock({ item, embedded = false }: { item: PreviewFile; embedded?: boolean }) {
  const { name, url, downloadUrl } = item
  const [open, setOpen] = useState(false)
  const [broken, setBroken] = useState(false)
  const type = kind(name)
  return <span className={styles.block}>
    <span className={styles.bar}>
      <File className={styles.fileIcon} /><span className={styles.title} title={name}>{name}</span>
      <span className={styles.badge}>{extension(name).toUpperCase() || 'FILE'}</span>
      <button type="button" className={styles.iconButton} onClick={() => setOpen(true)} title="打开预览" aria-label={`预览 ${name}`}><Expand /></button>
      <a className={styles.iconButton} href={downloadUrl ?? url} download={name} title="下载" aria-label={`下载 ${name}`}><Download /></a>
    </span>
    {type === 'image' && !broken ? <button type="button" className={styles.thumbnail} onClick={() => setOpen(true)}><img src={url} alt={name} loading="lazy" onError={() => setBroken(true)} /></button>
      : embedded && type === 'html' ? <HtmlFrame key={url} url={url} title={name} />
      : <button type="button" className={styles.summary} onClick={() => setOpen(true)}><File size={32} className={styles.summaryIcon} /><span className={styles.summaryText}>{name}<small>{type === 'binary' ? '查看信息或下载原文件' : '打开文件预览'}</small></span><Expand className={styles.summaryIcon} /></button>}
    {open && <FilePreview item={item} close={() => setOpen(false)} />}
  </span>
}

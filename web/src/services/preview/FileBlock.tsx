import { useState } from 'react'
import action from '../../ui/ActionButton.module.css'
import { ActionButton } from '../../ui/ActionButton.tsx'
import { Badge } from '../../ui/Badge.tsx'
import { Download, File, FullScreen } from '../../ui/icons.tsx'
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
      <File size="S" className={styles.fileIcon} /><span className={styles.title} title={name}>{name}</span>
      <Badge size="S">{extension(name).toUpperCase() || 'FILE'}</Badge>
      <ActionButton quiet size="S" icon={FullScreen} label={`预览 ${name}`} onClick={() => setOpen(true)} />
      <a className={action.button} data-size="S" data-quiet href={downloadUrl ?? url} download={name} title="下载" aria-label={`下载 ${name}`}><Download size="S" /></a>
    </span>
    {type === 'image' && !broken ? <button type="button" className={styles.thumbnail} onClick={() => setOpen(true)}><img src={url} alt={name} loading="lazy" onError={() => setBroken(true)} /></button>
      : embedded && type === 'html' ? <HtmlFrame key={url} url={url} title={name} />
      : <button type="button" className={styles.summary} onClick={() => setOpen(true)}><File className={styles.fileIcon} /><span>{name}<small>{type === 'binary' ? '查看信息或下载原文件' : '打开文件预览'}</small></span><FullScreen size="S" /></button>}
    {open && <FilePreview item={item} close={() => setOpen(false)} />}
  </span>
}

import { Badge, IconButton } from '@radix-ui/themes'
import { useState } from 'react'
import { DownloadIcon, EnterFullScreenIcon, FileIcon } from '../../ui/icons.ts'
import { FilePreview } from './FilePreview.tsx'
import { HtmlFrame } from './HtmlFrame.tsx'
import { extension, kind } from './kind.ts'
import type { PreviewFile } from './types.ts'
import styles from './FileBlock.module.css'

// 消息里的文件：Radix surface 卡片，顶上一栏是文件名和操作，下面是缩略图、内嵌网页或打开预览的一行。
// 它可能出现在段落里，所以全用行内元素
export function FileBlock({ item, embedded = false }: { item: PreviewFile; embedded?: boolean }) {
  const { name, url, downloadUrl } = item
  const [open, setOpen] = useState(false)
  const [broken, setBroken] = useState(false)
  const type = kind(name)
  return (
    <span className={styles.block}>
      <span className={styles.bar}>
        <FileIcon className={styles.icon} />
        <span className={styles.title} title={name}>{name}</span>
        <Badge size="1" variant="soft" color="gray">{extension(name).toUpperCase() || 'FILE'}</Badge>
        <IconButton type="button" size="1" variant="ghost" color="gray" onClick={() => setOpen(true)} title="打开预览" aria-label={`预览 ${name}`}>
          <EnterFullScreenIcon />
        </IconButton>
        <IconButton asChild size="1" variant="ghost" color="gray">
          <a href={downloadUrl ?? url} download={name} title="下载" aria-label={`下载 ${name}`}>
            <DownloadIcon />
          </a>
        </IconButton>
      </span>
      {type === 'image' && !broken ? (
        <button type="button" className={styles.thumbnail} onClick={() => setOpen(true)} aria-label={`预览 ${name}`}>
          <img src={url} alt={name} loading="lazy" onError={() => setBroken(true)} />
        </button>
      ) : embedded && type === 'html' ? (
        <HtmlFrame key={url} url={url} title={name} />
      ) : (
        <button type="button" className={styles.summary} onClick={() => setOpen(true)}>
          <FileIcon width={24} height={24} className={styles.icon} />
          <span className={styles.summaryText}>
            <span className={styles.summaryName}>{name}</span>
            <span className={styles.summaryHint}>{type === 'binary' ? '查看信息或下载原文件' : '打开文件预览'}</span>
          </span>
          <EnterFullScreenIcon className={styles.icon} />
        </button>
      )}
      {open && <FilePreview item={item} close={() => setOpen(false)} />}
    </span>
  )
}

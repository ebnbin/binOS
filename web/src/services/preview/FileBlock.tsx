import { useState } from 'react'
import { Download, Draft, OpenInFull } from '../../ui/icons.tsx'
import { IconButton } from '../../ui/IconButton.tsx'
import iconButton from '../../ui/IconButton.module.css'
import { Tooltip } from '../../ui/Tooltip.tsx'
import { FilePreview } from './FilePreview.tsx'
import { HtmlFrame } from './HtmlFrame.tsx'
import { extension, kind } from './kind.ts'
import type { PreviewFile } from './types.ts'
import styles from './FileBlock.module.css'

// 消息里的文件：M3 的描边卡片，顶上一行是文件的列表项，下面是图片缩略图、内嵌的网页或者打开预览的入口
export function FileBlock({ item, embedded = false }: { item: PreviewFile; embedded?: boolean }) {
  const { name, url, downloadUrl } = item
  const [open, setOpen] = useState(false)
  const [broken, setBroken] = useState(false)
  const type = kind(name)
  return <span className={styles.block}>
    <span className={styles.bar}>
      <span className={styles.icon}><Draft size={24} /></span>
      <span className={styles.heading}>
        <span className={styles.title} title={name}>{name}</span>
        <span className={styles.badge}>{extension(name).toUpperCase() || 'FILE'}</span>
      </span>
      <IconButton icon={OpenInFull} label="打开预览" aria-label={`预览 ${name}`} onClick={() => setOpen(true)} />
      <Tooltip label="下载">
        <a className={iconButton.button} data-variant="standard" data-size="s" data-width="default" href={downloadUrl ?? url} download={name} aria-label={`下载 ${name}`}><Download size={24} /></a>
      </Tooltip>
    </span>
    {type === 'image' && !broken ? <button type="button" className={styles.thumbnail} onClick={() => setOpen(true)}><img src={url} alt={name} loading="lazy" onError={() => setBroken(true)} /></button>
      : embedded && type === 'html' ? <HtmlFrame key={url} url={url} title={name} />
      : <button type="button" className={styles.summary} onClick={() => setOpen(true)}><span>{type === 'binary' ? '查看信息或下载原文件' : '打开文件预览'}</span><OpenInFull size={20} /></button>}
    {open && <FilePreview item={item} close={() => setOpen(false)} />}
  </span>
}

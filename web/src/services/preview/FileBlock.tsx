import { ChevronRightIcon, DownloadIcon, FileIcon, ScreenFullIcon } from '@primer/octicons-react'
import { useState } from 'react'
import { buttonProps } from '../../ui/button-props.ts'
import button from '../../ui/Button.module.css'
import { IconButton } from '../../ui/IconButton.tsx'
import { Label } from '../../ui/Label.tsx'
import { Tooltip } from '../../ui/Tooltip.tsx'
import { FilePreview } from './FilePreview.tsx'
import { HtmlFrame } from './HtmlFrame.tsx'
import { extension, kind } from './kind.ts'
import type { PreviewFile } from './types.ts'
import styles from './FileBlock.module.css'

// 消息里的文件：Primer Box，顶上一栏是文件名和操作，下面是缩略图、内嵌网页或一行说明。可能出现在段落里，只用 span
export function FileBlock({ item, embedded = false }: { item: PreviewFile; embedded?: boolean }) {
  const { name, url, downloadUrl } = item
  const [open, setOpen] = useState(false)
  const [broken, setBroken] = useState(false)
  const type = kind(name)
  return <span className={styles.block}>
    <span className={styles.bar}>
      <FileIcon size={16} className={styles.icon} />
      <span className={styles.title} title={name}>{name}</span>
      <Label>{extension(name).toUpperCase() || 'FILE'}</Label>
      <span className={styles.actions}>
        <IconButton icon={ScreenFullIcon} label={`预览 ${name}`} size="small" onClick={() => setOpen(true)} />
        <Tooltip text="下载">
          <a href={downloadUrl ?? url} download={name} aria-label={`下载 ${name}`} {...buttonProps({ variant: 'invisible', size: 'small' })} data-icon-only="">
            <span className={button.visual}><DownloadIcon size={16} /></span>
          </a>
        </Tooltip>
      </span>
    </span>
    {type === 'image' && !broken ? <button type="button" className={styles.thumbnail} onClick={() => setOpen(true)}><img src={url} alt={name} loading="lazy" onError={() => setBroken(true)} /></button>
      : embedded && type === 'html' ? <HtmlFrame key={url} url={url} title={name} />
      : <button type="button" className={styles.summary} onClick={() => setOpen(true)}>
        <FileIcon size={24} className={styles.icon} />
        <span className={styles.summaryText}>{name}<small>{type === 'binary' ? '查看信息或下载原文件' : '打开文件预览'}</small></span>
        <ChevronRightIcon size={16} className={styles.icon} />
      </button>}
    {open && <FilePreview item={item} close={() => setOpen(false)} />}
  </span>
}

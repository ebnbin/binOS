import { ArrowDownloadRegular } from '@fluentui/react-icons/headless/svg/arrow-download'
import { ArrowMaximizeRegular } from '@fluentui/react-icons/headless/svg/arrow-maximize'
import { DocumentRegular } from '@fluentui/react-icons/headless/svg/document'
import { useState } from 'react'
import { Badge } from '../../ui/Badge.tsx'
import buttonStyles from '../../ui/Button.module.css'
import { IconButton } from '../../ui/IconButton.tsx'
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
      <DocumentRegular className={styles.fileIcon} /><span className={styles.title} title={name}>{name}</span>
      <Badge appearance="tint" color="informative" size="small">{extension(name).toUpperCase() || 'FILE'}</Badge>
      <IconButton icon={<ArrowMaximizeRegular />} label="打开预览" aria-label={`预览 ${name}`} onClick={() => setOpen(true)} />
      <a className={buttonStyles.button} data-appearance="subtle" data-size="medium" data-icon-only href={downloadUrl ?? url} download={name} title="下载" aria-label={`下载 ${name}`}><span className={buttonStyles.icon}><ArrowDownloadRegular /></span></a>
    </span>
    {type === 'image' && !broken ? <button type="button" className={styles.thumbnail} onClick={() => setOpen(true)}><img src={url} alt={name} loading="lazy" onError={() => setBroken(true)} /></button>
      : embedded && type === 'html' ? <HtmlFrame key={url} url={url} title={name} />
      : <button type="button" className={styles.summary} onClick={() => setOpen(true)}><DocumentRegular className={styles.summaryIcon} /><span>{name}<small>{type === 'binary' ? '查看信息或下载原文件' : '打开文件预览'}</small></span><ArrowMaximizeRegular className={styles.summaryAction} /></button>}
    {open && <FilePreview item={item} close={() => setOpen(false)} />}
  </span>
}

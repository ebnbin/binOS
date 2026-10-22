import { Button } from '../../ui/Button.tsx'
import { Download, Expand, File } from '../../ui/icons.tsx'
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
  return (
    <span className={styles.block}>
      <span className={styles.bar}>
        <File size={16} />
        <span className={styles.title} title={name}>
          {name}
        </span>
        <span className={styles.badge}>{extension(name).toUpperCase() || 'FILE'}</span>
        <Button
          appearance="quiet"
          type="button"
          onClick={() => setOpen(true)}
          title="打开预览"
          aria-label={`预览 ${name}`}
        >
          <Expand size={15} />
        </Button>
        <a href={downloadUrl ?? url} download={name} title="下载" aria-label={`下载 ${name}`}>
          <Download size={15} />
        </a>
      </span>
      {type === 'image' && !broken ? (
        <Button appearance="quiet" type="button" className={styles.thumbnail} onClick={() => setOpen(true)}>
          <img src={url} alt={name} loading="lazy" onError={() => setBroken(true)} />
        </Button>
      ) : embedded && type === 'html' ? (
        <HtmlFrame key={url} url={url} title={name} />
      ) : (
        <Button appearance="quiet" type="button" className={styles.summary} onClick={() => setOpen(true)}>
          <File size={24} strokeWidth={1.25} />
          <span>
            {name}
            <small>{type === 'binary' ? '查看信息或下载原文件' : '打开文件预览'}</small>
          </span>
          <Expand size={16} />
        </Button>
      )}
      {open && <FilePreview item={item} close={() => setOpen(false)} />}
    </span>
  )
}

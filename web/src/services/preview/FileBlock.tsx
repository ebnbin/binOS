import { Button, Link } from '@fluentui/react-components'
import { ArrowDownloadRegular as Download, ArrowExpandRegular as Expand, DocumentRegular as File } from '@fluentui/react-icons'
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
        <File fontSize={16} />
        <span className={styles.title} title={name}>
          {name}
        </span>
        <span className={styles.badge}>{extension(name).toUpperCase() || 'FILE'}</span>
        <Button
          size="small"
          icon={<Expand fontSize={15} />}
          appearance="subtle"
          type="button"
          onClick={() => setOpen(true)}
          title="打开预览"
          aria-label={`预览 ${name}`}
        />
        <Link href={downloadUrl ?? url} download={name} title="下载" aria-label={`下载 ${name}`}>
          <Download fontSize={15} />
        </Link>
      </span>
      {type === 'image' && !broken ? (
        <Button size="small" appearance="subtle" type="button" className={styles.thumbnail} onClick={() => setOpen(true)}>
          <img src={url} alt={name} loading="lazy" onError={() => setBroken(true)} />
        </Button>
      ) : embedded && type === 'html' ? (
        <HtmlFrame key={url} url={url} title={name} />
      ) : (
        <Button size="small" appearance="subtle" type="button" className={styles.summary} onClick={() => setOpen(true)}>
          <File fontSize={24} />
          <span>
            {name}
            <small>{type === 'binary' ? '查看信息或下载原文件' : '打开文件预览'}</small>
          </span>
          <Expand fontSize={16} />
        </Button>
      )}
      {open && <FilePreview item={item} close={() => setOpen(false)} />}
    </span>
  )
}

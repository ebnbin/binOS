import type { Attachment } from '@binos/server/apps/kita/types'
import { FileText, X } from 'lucide-react'
import { useState } from 'react'
import { fileUrl } from '../api.ts'
import styles from './Attachments.module.css'

// 附件的两种样子：浏览器能显示的图片是方形缩略图，其他文件是带文件名的卡片

const isImage = (name: string) => /\.(png|jpe?g|gif|webp)$/i.test(name)

function FileCard({ name }: { name: string }) {
  return (
    <span className={styles.card}>
      <FileText size={18} strokeWidth={1.75} />
      <span className={styles.name}>{name}</span>
    </span>
  )
}

// 消息里已发出的附件：图片在新标签页打开原图，其他文件下载
export function AttachmentList({ sessionId, attachments }: { sessionId: number; attachments: Attachment[] }) {
  return (
    <div className={`${styles.list} ${styles.sent}`}>
      {attachments.map(({ file, name }) =>
        isImage(file) ? (
          <a key={file} className={styles.thumb} href={fileUrl(sessionId, file)} target="_blank" rel="noreferrer" title={name}>
            <img src={fileUrl(sessionId, file)} alt={name} loading="lazy" />
          </a>
        ) : (
          <a key={file} className={styles.link} href={fileUrl(sessionId, file, name)} target="_blank" rel="noreferrer" title={name}>
            <FileCard name={name} />
          </a>
        ),
      )}
    </div>
  )
}

// preview 是图片的本地预览地址
export type PendingFile = { key: number; file: File; preview?: string }

// 本地预览加载失败的（浏览器不认识的图片格式，比如 HEIC）退回文件卡片
function PendingItem({ file, preview }: { file: File; preview?: string }) {
  const [broken, setBroken] = useState(false)
  return preview && !broken ? (
    <span className={styles.thumb}>
      <img src={preview} alt={file.name} onError={() => setBroken(true)} />
    </span>
  ) : (
    <FileCard name={file.name} />
  )
}

// 输入框上方待发的附件，右上角可以移除
export function PendingAttachments({ files, onRemove }: { files: PendingFile[]; onRemove?: (key: number) => void }) {
  return (
    <div className={styles.list}>
      {files.map(({ key, file, preview }) => (
        <div key={key} className={styles.pending} title={file.name}>
          <PendingItem file={file} preview={preview} />
          {onRemove && (
            <button type="button" className={styles.remove} onClick={() => onRemove(key)} aria-label={`移除 ${file.name}`}>
              <X size={11} strokeWidth={2.5} />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

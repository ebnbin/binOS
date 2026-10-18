import { ImageOff } from 'lucide-react'
import { memo, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { fileUrl } from '../api.ts'
import { HtmlFrame } from './HtmlFrame.tsx'
import styles from './Markdown.module.css'

const remarkPlugins = [remarkGfm]

// 和后端一致：路径里的转义还原后再找快照
function decodeReference(reference: string) {
  try {
    return decodeURI(reference)
  } catch {
    return reference
  }
}

// 回复引用的本机图片和网页，后端存了快照（files：路径 → 快照文件名）
function MarkdownImage({
  sessionId,
  files,
  src,
  alt,
}: {
  sessionId: number
  files: Record<string, string> | undefined
  src: unknown
  alt: string | undefined
}) {
  const snapshot = typeof src === 'string' ? files?.[decodeReference(src)] : undefined
  if (snapshot?.endsWith('.html')) {
    return <HtmlFrame sessionId={sessionId} file={snapshot} title={alt || '网页'} />
  }
  const url = snapshot ? fileUrl(sessionId, snapshot) : typeof src === 'string' && /^https?:\/\//.test(src) ? src : undefined
  if (!url) {
    return (
      <span className={styles.missingImage}>
        <ImageOff size={14} strokeWidth={1.75} />
        {alt || '图片'}
      </span>
    )
  }
  return (
    <a className={styles.image} href={url} target="_blank" rel="noreferrer">
      <img src={url} alt={alt ?? ''} loading="lazy" />
    </a>
  )
}

// 回答过程中文本会频繁更新，内容不变的段落不重新解析
export const Markdown = memo(function Markdown({
  sessionId,
  text,
  files,
}: {
  sessionId: number
  text: string
  files?: Record<string, string>
}) {
  const components = useMemo<Components>(
    () => ({
      a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
      img: ({ src, alt }) => <MarkdownImage sessionId={sessionId} files={files} src={src} alt={alt} />,
      table: ({ node: _node, ...props }) => (
        <div className={styles.tableWrap}>
          <table {...props} />
        </div>
      ),
    }),
    [sessionId, files],
  )
  return (
    <div className={styles.markdown}>
      <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  )
})

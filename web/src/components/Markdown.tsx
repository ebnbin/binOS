import { ImageOff } from 'lucide-react'
import { memo, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { fileUrl } from '../api.ts'
import styles from './Markdown.module.css'

const remarkPlugins = [remarkGfm]

// 后端把回复引用的本机图片存进 session 后，引用会改成存下的文件名
const sessionFile = /^[\w-]+\.(png|jpg|gif|webp)$/

function MarkdownImage({ sessionId, src, alt }: { sessionId: number; src: unknown; alt: string | undefined }) {
  const url = typeof src !== 'string' ? undefined : sessionFile.test(src) ? fileUrl(sessionId, src) : /^https?:\/\//.test(src) ? src : undefined
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
export const Markdown = memo(function Markdown({ sessionId, text }: { sessionId: number; text: string }) {
  const components = useMemo<Components>(
    () => ({
      a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
      img: ({ src, alt }) => <MarkdownImage sessionId={sessionId} src={src} alt={alt} />,
      table: ({ node: _node, ...props }) => (
        <div className={styles.tableWrap}>
          <table {...props} />
        </div>
      ),
    }),
    [sessionId],
  )
  return (
    <div className={styles.markdown}>
      <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  )
})

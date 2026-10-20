import 'katex/dist/katex.min.css'
import { ImageOff } from 'lucide-react'
import { memo, useMemo } from 'react'
import type { ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components, Options } from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { threadFileUrl } from '../api.ts'
import { CodeBlock } from './CodeBlock.tsx'
import { FileBlock } from '../../../ui/files/FileBlock.tsx'
import styles from './Markdown.module.css'
import { Mermaid } from './Mermaid.tsx'

// 行内公式 $…$，单独成段的 $$…$$
const remarkPlugins: Options['remarkPlugins'] = [remarkGfm, remarkMath]
const rehypePlugins: Options['rehypePlugins'] = [rehypeKatex]

// 围起来的代码块带语言（language-xxx）或者以换行结尾，行内代码两者都没有
function MarkdownCode({ className, children }: { className?: string; children?: ReactNode }) {
  const lang = /language-(\S+)/.exec(className ?? '')?.[1]
  const text = String(children ?? '')
  if (!lang && !text.endsWith('\n')) {
    return <code className={className}>{children}</code>
  }
  const code = text.replace(/\n$/, '')
  return lang === 'mermaid' ? <Mermaid code={code} /> : <CodeBlock code={code} lang={lang} label={lang ?? ''} />
}

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
  thread,
  files,
  src,
  alt,
}: {
  thread: string
  files: Record<string, string> | undefined
  src: unknown
  alt: string | undefined
}) {
  const snapshot = typeof src === 'string' ? files?.[decodeReference(src)] : undefined
  if (snapshot) {
    const name = typeof src === 'string' ? decodeReference(src).split('/').at(-1)! : alt || snapshot
    return <FileBlock thread={thread} file={snapshot} name={name} path={String(src)} embedded />
  }
  const url = snapshot ? threadFileUrl(thread, snapshot) : typeof src === 'string' && /^https?:\/\//.test(src) ? src : undefined
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
  thread,
  text,
  files,
}: {
  thread: string
  text: string
  files?: Record<string, string>
}) {
  const components = useMemo<Components>(
    () => ({
      a: ({ node: _node, href, children, ...props }) => {
        const reference = href ? decodeReference(href) : ''
        const file = files?.[reference]
        return file ? <FileBlock thread={thread} file={file} name={reference.split('/').at(-1) || file} path={reference} />
          : <a {...props} href={href} target="_blank" rel="noreferrer">{children}</a>
      },
      img: ({ src, alt }) => <MarkdownImage thread={thread} files={files} src={src} alt={alt} />,
      pre: ({ children }) => <div className={styles.codeBlock}>{children}</div>,
      code: ({ className, children }) => <MarkdownCode className={className}>{children}</MarkdownCode>,
      table: ({ node: _node, ...props }) => (
        <div className={styles.tableWrap}>
          <table {...props} />
        </div>
      ),
    }),
    [thread, files],
  )
  return (
    <div className={styles.markdown}>
      <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  )
})

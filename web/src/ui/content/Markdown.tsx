import 'katex/dist/katex.min.css'
import { Blockquote, Code, Heading, Link, Separator, Table } from '@radix-ui/themes'
import { memo, useMemo } from 'react'
import type { ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components, Options } from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { ImageOffIcon } from '../icons.ts'
import { CodeBlock } from './CodeBlock.tsx'
import styles from './Markdown.module.css'
import { Mermaid } from './Mermaid.tsx'

// 行内公式 $…$，单独成段的 $$…$$
const remarkPlugins: Options['remarkPlugins'] = [remarkGfm, remarkMath]
const rehypePlugins: Options['rehypePlugins'] = [rehypeKatex]

// 正文字号对应 Radix 的 Text size：3 是阅读内容（对话消息、文档），2 是次要内容（思考、工具输出）。
// 标题按 Heading 的字号阶梯，从正文往上数
export type MarkdownSize = '2' | '3'
type HeadingSize = '2' | '3' | '4' | '5' | '6'
const headingSizes: Record<MarkdownSize, [HeadingSize, HeadingSize, HeadingSize, HeadingSize]> = {
  '3': ['6', '5', '4', '3'],
  '2': ['5', '4', '3', '2'],
}

// 围起来的代码块带语言（language-xxx）或者以换行结尾，行内代码两者都没有
function MarkdownCode({ className, children }: { className?: string; children?: ReactNode }) {
  const lang = /language-(\S+)/.exec(className ?? '')?.[1]
  const text = String(children ?? '')
  if (!lang && !text.endsWith('\n')) {
    return <Code variant="soft" className={className}>{children}</Code>
  }
  const code = text.replace(/\n$/, '')
  return lang === 'mermaid' ? <Mermaid code={code} /> : <CodeBlock code={code} lang={lang} label={lang ?? ''} />
}

export type RenderFile = (reference: string, embedded: boolean) => ReactNode

function MarkdownImage({ src, alt, renderFile }: { src: unknown; alt?: string; renderFile?: RenderFile }) {
  const file = typeof src === 'string' ? renderFile?.(src, true) : undefined
  if (file) return file
  if (typeof src !== 'string' || !/^https?:\/\//.test(src)) {
    return <span className={styles.missingImage}><ImageOffIcon />{alt || '图片'}</span>
  }
  return <a className={styles.image} href={src} target="_blank" rel="noreferrer"><img src={src} alt={alt ?? ''} loading="lazy" /></a>
}

// 回答过程中文本会频繁更新，内容不变的段落不重新解析
export const Markdown = memo(function Markdown({
  text,
  renderFile,
  size = '3',
}: {
  text: string
  renderFile?: RenderFile
  size?: MarkdownSize
}) {
  const components = useMemo<Components>(() => {
    const [h1, h2, h3, h4] = headingSizes[size]
    return {
      h1: ({ children }) => <Heading as="h1" size={h1} className={styles.heading}>{children}</Heading>,
      h2: ({ children }) => <Heading as="h2" size={h2} className={styles.heading}>{children}</Heading>,
      h3: ({ children }) => <Heading as="h3" size={h3} className={styles.heading}>{children}</Heading>,
      h4: ({ children }) => <Heading as="h4" size={h4} className={styles.heading}>{children}</Heading>,
      h5: ({ children }) => <Heading as="h5" size={h4} className={styles.heading}>{children}</Heading>,
      h6: ({ children }) => <Heading as="h6" size={h4} className={styles.heading}>{children}</Heading>,
      a: ({ href, title, id, children }) =>
        (href && renderFile?.(href, false)) || (
          <Link href={href} title={title} id={id} target="_blank" rel="noreferrer" underline="always">
            {children}
          </Link>
        ),
      img: ({ src, alt }) => <MarkdownImage src={src} alt={alt} renderFile={renderFile} />,
      pre: ({ children }) => <div className={styles.codeBlock}>{children}</div>,
      code: ({ className, children }) => <MarkdownCode className={className}>{children}</MarkdownCode>,
      blockquote: ({ children }) => <Blockquote className={styles.blockquote}>{children}</Blockquote>,
      hr: () => <Separator size="4" className={styles.separator} />,
      table: ({ children }) => (
        <Table.Root size="1" variant="surface" className={styles.table}>
          {children}
        </Table.Root>
      ),
      thead: ({ children }) => <Table.Header>{children}</Table.Header>,
      tbody: ({ children }) => <Table.Body>{children}</Table.Body>,
      tr: ({ children }) => <Table.Row>{children}</Table.Row>,
      th: ({ children, style }) => <Table.ColumnHeaderCell className={styles.headerCell} style={style}>{children}</Table.ColumnHeaderCell>,
      td: ({ children, style }) => <Table.Cell style={style}>{children}</Table.Cell>,
    }
  }, [renderFile, size])
  return (
    <div className={styles.markdown} data-size={size}>
      <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  )
})

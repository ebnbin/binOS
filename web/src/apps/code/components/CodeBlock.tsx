import { useHighlight } from '../highlight.ts'
import styles from './CodeBlock.module.css'
import { CopyButton } from './CopyButton.tsx'

// 代码块：按语言高亮；startLine 有值时显示行号；label 有值时顶上一栏显示它和复制按钮
export function CodeBlock({ code, lang, startLine, label }: { code: string; lang?: string; startLine?: number; label?: string }) {
  const tokens = useHighlight(code, lang)
  const lines = tokens ?? code.split('\n').map((content) => [{ content, htmlStyle: undefined }])
  return (
    <div className={styles.block}>
      {label !== undefined && (
        <div className={styles.header}>
          <span>{label}</span>
          <CopyButton text={code} label="复制代码" />
        </div>
      )}
      <pre className={styles.pre}>
        <code>
          {lines.map((line, i) => (
            <span key={i} className={styles.line}>
              {startLine !== undefined && <span className={styles.gutter}>{startLine + i}</span>}
              {line.map((token, j) => (
                <span key={j} className={styles.token} style={token.htmlStyle}>
                  {token.content}
                </span>
              ))}
              {'\n'}
            </span>
          ))}
        </code>
      </pre>
    </div>
  )
}

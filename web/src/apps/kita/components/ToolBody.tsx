import { diffLines } from 'diff'
import { fileUrl } from '../api.ts'
import { languageOf } from '../highlight.ts'
import type { ToolResult, ToolUse } from '../tool-calls.ts'
import { CodeBlock } from './CodeBlock.tsx'
import { Markdown } from './Markdown.tsx'
import styles from './ToolBody.module.css'

const text = (value: unknown) => (typeof value === 'string' ? value : '')

// 展开一次工具调用看到的内容：常用的工具按各自的样子显示，其他的显示参数和输出
export function ToolBody({ sessionId, use, result }: { sessionId: number; use: ToolUse; result: ToolResult | undefined }) {
  const input = use.input as Record<string, unknown>
  // 出错的调用显示报错；Bash 的报错就是它的输出，照样显示成终端
  const failed = result?.status === 'error' && use.name !== 'Bash'
  return (
    <>
      {failed ? <Output result={result} /> : <Content sessionId={sessionId} name={use.name} input={input} result={result} />}
      {result?.images?.map((file) => (
        <a key={file} className={styles.image} href={fileUrl(sessionId, file)} target="_blank" rel="noreferrer">
          <img src={fileUrl(sessionId, file)} alt="" />
        </a>
      ))}
    </>
  )
}

function Content({
  sessionId,
  name,
  input,
  result,
}: {
  sessionId: number
  name: string
  input: Record<string, unknown>
  result: ToolResult | undefined
}) {
  switch (name) {
    case 'Bash':
      return <Terminal command={text(input.command)} result={result} />
    case 'Read':
      return result?.output ? <FileContent path={text(input.file_path)} output={result.output} /> : null
    case 'Write':
      return <CodeBlock code={text(input.content).replace(/\n$/, '')} lang={languageOf(text(input.file_path))} startLine={1} />
    case 'Edit':
      return <Diff before={text(input.old_string)} after={text(input.new_string)} replaceAll={input.replace_all === true} />
    case 'Patch':
      return <Patch kind={text(input.kind)} diff={text(input.diff)} path={text(input.file_path)} />
    case 'WebSearch':
      return result?.output ? <SearchResults sessionId={sessionId} output={result.output} /> : null
    case 'WebFetch':
      return (
        <>
          {typeof input.prompt === 'string' && <p className={styles.note}>{input.prompt}</p>}
          {result?.output && <Markdown sessionId={sessionId} text={result.output} />}
        </>
      )
    default:
      return (
        <>
          <CodeBlock code={JSON.stringify(input, null, 2)} lang="json" />
          <Output result={result} />
        </>
      )
  }
}

function Output({ result }: { result: ToolResult | undefined }) {
  if (!result?.output) {
    return null
  }
  return (
    <pre className={styles.output} data-error={result.status === 'error'}>
      {result.truncated ? `…（前面的输出已省略）\n${result.output}` : result.output}
    </pre>
  )
}

function Terminal({ command, result }: { command: string; result: ToolResult | undefined }) {
  return (
    <pre className={styles.terminal}>
      <span className={styles.prompt}>$ </span>
      {command}
      {result?.output && (
        <span className={styles.terminalOutput} data-error={result.status === 'error'}>
          {'\n'}
          {result.truncated && '…（前面的输出已省略）\n'}
          {result.output}
        </span>
      )}
    </pre>
  )
}

// Read 的输出每行是「行号\t内容」（最后的空行只有行号）：拆出行号，内容按文件类型高亮。对不上这个格式（比如被截断了）就原样显示
function FileContent({ path, output }: { path: string; output: string }) {
  const lines = output.split('\n').map((line) => /^\s*(\d+)(?:\t(.*))?$/.exec(line))
  if (lines.some((match) => !match)) {
    return <pre className={styles.output}>{output}</pre>
  }
  return <CodeBlock code={lines.map((match) => match![2] ?? '').join('\n')} lang={languageOf(path)} startLine={Number(lines[0]![1])} />
}

function Diff({ before, after, replaceAll }: { before: string; after: string; replaceAll: boolean }) {
  const parts = diffLines(before, after)
  return (
    <div className={styles.diff}>
      {replaceAll && <div className={styles.note}>替换全部出现的地方</div>}
      <pre className={styles.diffLines}>
        {parts.flatMap((part, i) =>
          part.value
            .replace(/\n$/, '')
            .split('\n')
            .map((line, j) => (
              <span key={`${i}-${j}`} className={styles.diffLine} data-change={part.added ? 'added' : part.removed ? 'removed' : undefined}>
                <span className={styles.diffSign}>{part.added ? '+' : part.removed ? '-' : ' '}</span>
                {line}
                {'\n'}
              </span>
            )),
        )}
      </pre>
    </div>
  )
}

// 改的一个文件（Patch）：新建时 diff 是文件内容，删除时是删掉的内容，修改时是统一格式的 diff
function Patch({ kind, diff, path }: { kind: string; diff: string; path: string }) {
  if (kind === 'add') {
    return <CodeBlock code={diff.replace(/\n$/, '')} lang={languageOf(path)} startLine={1} />
  }
  if (kind === 'delete') {
    return <p className={styles.note}>删除了这个文件</p>
  }
  return (
    <div className={styles.diff}>
      <pre className={styles.diffLines}>
        {diff
          .replace(/\n$/, '')
          .split('\n')
          .filter((line) => !line.startsWith('+++') && !line.startsWith('---'))
          .map((line, i) => {
            const sign = line[0]
            const change = sign === '+' ? 'added' : sign === '-' ? 'removed' : undefined
            return (
              <span key={i} className={styles.diffLine} data-change={change} data-hunk={sign === '@' || undefined}>
                <span className={styles.diffSign}>{change ? sign : ' '}</span>
                {sign === '+' || sign === '-' || sign === ' ' ? line.slice(1) : line}
                {'\n'}
              </span>
            )
          })}
      </pre>
    </div>
  )
}

// WebSearch 的输出：一行「Links: [JSON]」列出搜到的网页，后面是总结
function SearchResults({ sessionId, output }: { sessionId: number; output: string }) {
  const match = /^Links: (\[.*\])$/m.exec(output)
  let links: { title?: string; url?: string }[] = []
  try {
    links = match ? JSON.parse(match[1]) : []
  } catch {
    // 解析不了就只显示文字
  }
  const summary = match ? output.slice(match.index + match[0].length).trim() : output
  return (
    <>
      {links.length > 0 && (
        <ul className={styles.links}>
          {links.map((link, i) =>
            link.url ? (
              <li key={i}>
                <a href={link.url} target="_blank" rel="noreferrer">
                  <span className={styles.linkTitle}>{link.title || link.url}</span>
                  <span className={styles.linkHost}>{hostOf(link.url)}</span>
                </a>
              </li>
            ) : null,
          )}
        </ul>
      )}
      {summary && <Markdown sessionId={sessionId} text={summary} />}
    </>
  )
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

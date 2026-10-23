import type { Project, SessionSummary } from '@binos/server/apps/code/types'
import type { searchContent } from '../api.ts'
import { Button } from '../../../ui/Button.tsx'
import { Chat, ChevronRight, Search, User } from '../../../ui/icons.tsx'
import { ProgressCircle } from '../../../ui/ProgressCircle.tsx'
import styles from './SearchResults.module.css'

type Results = Awaited<ReturnType<typeof searchContent>>
type Match = Results['results'][number]

export function SearchResults({
  query,
  data,
  failed,
  onRetry,
  sessions,
  projects,
  onNavigate,
}: {
  query: string
  data?: Results
  failed?: boolean
  onRetry: () => void
  sessions: SessionSummary[] | undefined
  projects: Project[] | undefined
  onNavigate: (route: string) => void
}) {
  if (failed)
    return (
      <div className={styles.state} role="alert">
        <span className={styles.stateTitle}>搜索失败</span>
        <p>未能加载结果，请重试。</p>
        <Button variant="secondary" size="S" onClick={onRetry}>
          重新搜索
        </Button>
      </div>
    )
  if (!data)
    return (
      <div className={styles.loading} role="status">
        <ProgressCircle label="正在搜索" />
        正在搜索…
      </div>
    )
  if (!data.results.length)
    return (
      <div className={styles.state} role="status">
        <Search className={styles.stateIcon} />
        <span className={styles.stateTitle}>没有找到相关内容</span>
        <p>试试更短的关键词，或换个说法。</p>
      </div>
    )
  const groups = new Map<number, Match[]>()
  for (const result of data.results) {
    const group = groups.get(result.id)
    if (group) group.push(result)
    else groups.set(result.id, [result])
  }
  return (
    <div className={styles.results}>
      <div className={styles.summary} role="status">
        <span>搜索结果</span>
        <span>{data.total} 处匹配</span>
      </div>
      {data.total > data.results.length && (
        <p className={styles.limit}>仅显示前 {data.results.length} 处匹配，可使用更具体的关键词查找其他结果。</p>
      )}
      {[...groups].map(([id, matches]) => {
        const result = matches[0]
        const projectId = sessions?.find((session) => session.id === id)?.project
        const project = projects?.find((project) => project.id === projectId)?.name
        const titleMatch = matches.find((match) => match.kind === 'title')
        return (
          <section className={styles.group} key={id} aria-label={result.title || '无标题对话'}>
            <button type="button" className={styles.heading} onClick={() => onNavigate(`/${id}`)}>
              <span className={styles.context}>
                {[project, `#${id}`, result.archived ? '已归档' : undefined].filter(Boolean).join(' · ')}
              </span>
              <span className={styles.title}>
                {titleMatch ? <HighlightedTitle title={result.title} query={query} /> : result.title || '无标题对话'}
              </span>
              <span className={styles.count}>
                {matches.length} 处匹配
                <ChevronRight size="XS" />
              </span>
            </button>
            {matches
              .filter((match) => match.kind !== 'title')
              .map((match) => {
                const Icon = match.kind === 'input' ? User : Chat
                return (
                  <button type="button" className={styles.match} key={match.item} onClick={() => onNavigate(`/${id}?item=${match.item}`)}>
                    <span className={styles.kind}>
                      <Icon size="XS" />
                      {match.kind === 'input' ? '你' : '回复'}
                    </span>
                    <span className={styles.snippet}>
                      {match.before}
                      <mark>{match.match}</mark>
                      {match.after}
                    </span>
                  </button>
                )
              })}
          </section>
        )
      })}
    </div>
  )
}

function HighlightedTitle({ title, query }: { title: string; query: string }) {
  const at = title.toLowerCase().indexOf(query.toLowerCase())
  return at < 0 ? (
    title
  ) : (
    <>
      {title.slice(0, at)}
      <mark>{title.slice(at, at + query.length)}</mark>
      {title.slice(at + query.length)}
    </>
  )
}

import { ChevronRight, Lightbulb } from 'lucide-react'
import { formatDuration } from '../format.ts'
import { Markdown } from './Markdown.tsx'
import styles from './Thinking.module.css'

// 思考的摘要：正在想的时候展开，想完了折叠成一行
export function Thinking({ sessionId, text, durationMs, live }: { sessionId: number; text: string; durationMs?: number; live?: boolean }) {
  const label = live ? '正在思考' : durationMs !== undefined ? `思考了 ${formatDuration(durationMs)}` : '思考过程'
  return (
    <details className={styles.thinking} open={live}>
      <summary className={styles.summary}>
        <Lightbulb size={14} strokeWidth={1.75} />
        <span>{label}</span>
        <ChevronRight size={14} strokeWidth={1.75} className={styles.chevron} />
      </summary>
      <div className={styles.body}>
        <Markdown sessionId={sessionId} text={text} />
      </div>
    </details>
  )
}

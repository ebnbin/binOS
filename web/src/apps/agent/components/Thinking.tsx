import { Lightbulb } from 'lucide-react'
import { formatDuration } from '../format.ts'
import { Activity } from './Activity.tsx'
import styles from './Thinking.module.css'
import { Markdown } from './Markdown.tsx'

// 思考的摘要：正在想的时候展开，想完了是一行
export function Thinking({ sessionId, text, durationMs, live }: { sessionId: number; text: string; durationMs?: number; live?: boolean }) {
  return (
    <Activity
      icon={<Lightbulb size={14} strokeWidth={1.75} />}
      label={live ? '正在思考' : durationMs !== undefined ? `思考了 ${formatDuration(durationMs)}` : '思考'}
      defaultOpen={live}
      body={() => (
        <div className={styles.text}>
          <Markdown sessionId={sessionId} text={text} />
        </div>
      )}
    />
  )
}

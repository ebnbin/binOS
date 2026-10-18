import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import styles from './Activity.module.css'
import { Spinner } from '../../../ui/Spinner.tsx'

export type ActivityStatus = 'running' | 'done' | 'error' | 'stopped'

// 回答过程里的一行活动（思考、工具调用、子 agent，以及它们合起来的摘要）：图标、一句话、细节和耗时。
// body 展开时才渲染：一个会话里有上百次调用，不展开的不用渲染内容。open 给了就由外面控制
export function Activity({
  icon,
  label,
  detail,
  meta,
  status = 'done',
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  body,
}: {
  icon: ReactNode
  label: ReactNode
  detail?: ReactNode
  meta?: ReactNode
  status?: ActivityStatus
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  body?: () => ReactNode
}) {
  const [ownOpen, setOwnOpen] = useState(defaultOpen)
  const open = controlledOpen ?? ownOpen
  const toggle = () => {
    setOwnOpen(!open)
    onOpenChange?.(!open)
  }
  return (
    <div className={styles.activity} data-status={status} data-open={open || undefined}>
      <button type="button" className={styles.row} onClick={toggle} disabled={!body} aria-expanded={body ? open : undefined}>
        <span className={styles.icon}>{status === 'running' ? <Spinner /> : icon}</span>
        <span className={styles.label}>{label}</span>
        {detail && <span className={styles.detail}>{detail}</span>}
        {meta && <span className={styles.meta}>{meta}</span>}
        {body && <ChevronRight size={14} strokeWidth={1.75} className={styles.chevron} />}
      </button>
      {open && body && <div className={styles.body}>{body()}</div>}
    </div>
  )
}

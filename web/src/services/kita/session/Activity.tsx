import { useState } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle } from '../../../ui/icons.tsx'
import type { Icon } from '../../../ui/icons.tsx'
import { ProgressCircle } from '../../../ui/ProgressCircle.tsx'
import { UiIcon } from '../../../ui/UiIcon.tsx'
import styles from './Activity.module.css'

export type ActivityStatus = 'running' | 'done' | 'error' | 'stopped'

// 回答过程里的一步（思考、工具调用、子 agent）：展开箭头、图标（进行中是转圈，出错是警告）、动作、细节和右边的耗时等。
// preview 是收起时显示在下面的几行（比如命令输出的最后几行）。body 展开时才渲染：一个会话里有上百步，不展开的不用渲染
export function Activity({
  icon: StepIcon,
  label,
  detail,
  meta,
  preview,
  status = 'done',
  quiet = false,
  defaultOpen = false,
  body,
}: {
  icon?: Icon
  label: ReactNode
  detail?: ReactNode
  meta?: ReactNode
  preview?: string
  status?: ActivityStatus
  // 次要的一步（思考）：动作也用淡色
  quiet?: boolean
  defaultOpen?: boolean
  body?: () => ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div data-status={status} data-quiet={quiet || undefined}>
      <button type="button" className={styles.row} onClick={() => setOpen(!open)} disabled={!body} aria-expanded={body ? open : undefined}>
        <span className={styles.chevron}>{body && <UiIcon glyph="chevron" direction={open ? 'down' : undefined} />}</span>
        <span className={styles.icon}>
          {status === 'running' ? <ProgressCircle /> : status === 'error' ? <AlertTriangle size="S" /> : StepIcon && <StepIcon size="S" />}
        </span>
        <span className={styles.label}>{label}</span>
        {detail && <span className={styles.detail}>{detail}</span>}
        {meta && <span className={styles.meta}>{meta}</span>}
      </button>
      {!open && preview && <pre className={styles.preview}>{preview}</pre>}
      {open && body && <div className={styles.body}>{body()}</div>}
    </div>
  )
}

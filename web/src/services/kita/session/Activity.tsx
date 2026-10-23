import { AlertIcon, ChevronRightIcon, DotFillIcon } from '@primer/octicons-react'
import type { Icon } from '@primer/octicons-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Spinner } from '../../../ui/Spinner.tsx'
import styles from './Activity.module.css'

export type ActivityStatus = 'running' | 'done' | 'error' | 'stopped'

// 回答过程里的一步（思考、工具调用、子 agent），像 Primer Timeline 的一项：图标、动作、细节和右边的耗时等。
// 进行中图标换成 Spinner，出错换成警告图标。展开的内容挂在图标下面的竖线上。
// preview 是收起时显示在下面的几行（比如命令输出的最后几行）。body 展开时才渲染：一个会话里有上百步，不展开的不用渲染
export function Activity({
  icon: Visual = DotFillIcon,
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
    <div className={styles.activity} data-status={status} data-quiet={quiet || undefined} data-open={open || undefined}>
      <button type="button" className={styles.row} onClick={() => setOpen(!open)} disabled={!body} aria-expanded={body ? open : undefined}>
        <span className={styles.icon}>{status === 'running' ? <Spinner /> : status === 'error' ? <AlertIcon size={16} /> : <Visual size={16} />}</span>
        <span className={styles.label}>{label}</span>
        {detail && <span className={styles.detail}>{detail}</span>}
        {meta && <span className={styles.meta}>{meta}</span>}
        {body && <ChevronRightIcon size={16} className={styles.chevron} />}
      </button>
      {!open && preview && <pre className={styles.preview}>{preview}</pre>}
      {open && body && <div className={styles.body}>{body()}</div>}
    </div>
  )
}

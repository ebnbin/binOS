import { CommentIcon, PencilIcon } from '@primer/octicons-react'
import type { WidgetContext } from '../types.ts'
import styles from './CodeWidget.module.css'
import { IconButton } from '../../ui/IconButton.tsx'
import { Label } from '../../ui/Label.tsx'
import list from '../../ui/ActionList.module.css'
import { Spinner } from '../../ui/Spinner.tsx'
import { formatTime } from '../../ui/time.ts'
import { useSessions } from './useSessions.ts'

// 最近的对话，点一条直接打开
export function CodeWidget({ size, open }: WidgetContext) {
  const { sessions } = useSessions()
  const running = sessions?.filter((session) => session.running).length ?? 0
  const shown = sessions?.slice(0, size === '4x4' ? 8 : 3) ?? []

  return (
    <div className={styles.widget}>
      <header className={styles.header}>
        <h3 className={styles.name}>Code</h3>
        {running > 0 && <Label variant="accent">{running} 个进行中</Label>}
        <IconButton
          icon={PencilIcon}
          label="新对话"
          size="small"
          className={styles.new}
          onClick={(event) => {
            event.stopPropagation()
            open('/new')
          }}
        />
      </header>
      {size === '2x2' ? (
        <div className={styles.summary}>
          <span className={styles.count}>{sessions?.length ?? '…'}</span>
          <span className={styles.muted}>个对话</span>
        </div>
      ) : sessions?.length === 0 ? (
        <p className={styles.empty}>还没有对话</p>
      ) : (
        <ul className={styles.list}>
          {shown.map((session) => (
            <li key={session.id}>
              <button
                type="button"
                className={`${list.item} ${styles.row}`}
                onClick={(event) => {
                  event.stopPropagation()
                  open(`/${session.id}`)
                }}
              >
                <span className={list.visual} data-running={session.running}>{session.running ? <Spinner /> : <CommentIcon size={16} />}</span>
                <span className={`${list.label} ${styles.title}`}>{session.title || '新对话'}</span>
                <span className={list.trailing}>{session.updatedAt ? formatTime(new Date(session.updatedAt)) : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

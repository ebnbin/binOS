import type { WidgetContext } from '../types.ts'
import { IconButton } from '../../ui/IconButton.tsx'
import { New } from '../../ui/icons.tsx'
import { StatusLight } from '../../ui/StatusLight.tsx'
import styles from './CodeWidget.module.css'
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
        <span className={styles.name}>Code</span>
        {running > 0 && (
          <StatusLight variant="informative" size="S">
            {running} 个进行中
          </StatusLight>
        )}
        <IconButton
          icon={New}
          size="S"
          label="新对话"
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
                className={styles.row}
                onClick={(event) => {
                  event.stopPropagation()
                  open(`/${session.id}`)
                }}
              >
                <span className={styles.dot} data-running={session.running} />
                <span className={styles.title}>{session.title || '新对话'}</span>
                <span className={styles.time}>{session.updatedAt ? formatTime(new Date(session.updatedAt)) : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

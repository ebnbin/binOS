import { Text } from '@radix-ui/themes'
import type { WidgetContext } from '../types.ts'
import styles from './CodeWidget.module.css'
import { IconButton } from '../../ui/IconButton.tsx'
import { Pencil2Icon } from '../../ui/icons.ts'
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
        <Text size="2" weight="medium">Code</Text>
        {running > 0 && <Text size="1" className={styles.running}>{running} 个进行中</Text>}
        <IconButton
          icon={Pencil2Icon}
          label="新对话"
          size="1"
          className={styles.new}
          onClick={(event) => {
            event.stopPropagation()
            open('/new')
          }}
        />
      </header>
      {size === '2x2' ? (
        <div className={styles.summary}>
          <Text size="7" weight="bold" className={styles.count}>{sessions?.length ?? '…'}</Text>
          <Text size="2" color="gray">个对话</Text>
        </div>
      ) : sessions?.length === 0 ? (
        <Text as="p" size="2" color="gray" className={styles.empty}>还没有对话</Text>
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

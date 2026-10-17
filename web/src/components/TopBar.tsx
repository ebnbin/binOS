import { Menu, SquarePen } from 'lucide-react'
import styles from './TopBar.module.css'
import { IconButton } from './ui/IconButton.tsx'

export function TopBar({
  title,
  sessionId,
  onMenu,
  onNew,
}: {
  title: string
  sessionId: number | null | undefined
  onMenu: () => void
  onNew: () => void
}) {
  return (
    <header className={styles.bar}>
      <IconButton icon={Menu} label="对话列表" className={styles.mobileOnly} onClick={onMenu} />
      <div className={styles.heading}>
        {sessionId != null && (
          <>
            <span className={styles.title}>{title}</span>
            <span className={styles.id}>#{sessionId}</span>
          </>
        )}
      </div>
      <IconButton icon={SquarePen} label="新对话" className={styles.mobileOnly} onClick={onNew} disabled={sessionId === null} />
    </header>
  )
}

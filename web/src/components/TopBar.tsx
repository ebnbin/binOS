import { ChevronLeft, SquarePen } from 'lucide-react'
import { back, navigate } from '../router.ts'
import styles from './TopBar.module.css'
import { IconButton } from './ui/IconButton.tsx'

// 一列时左边返回列表、右边新对话；两列时列表就在旁边，只显示标题
export function TopBar({ title, sessionId }: { title: string; sessionId: number | null }) {
  return (
    <header className={styles.bar}>
      <IconButton icon={ChevronLeft} label="返回对话列表" className={styles.singleColumnOnly} onClick={back} />
      <div className={styles.heading}>
        {sessionId === null ? (
          <span className={`${styles.title} ${styles.singleColumnOnly}`}>新对话</span>
        ) : (
          <>
            <span className={styles.title}>{title}</span>
            <span className={styles.id}>#{sessionId}</span>
          </>
        )}
      </div>
      <IconButton
        icon={SquarePen}
        label="新对话"
        className={styles.singleColumnOnly}
        onClick={() => navigate('/new')}
        disabled={sessionId === null}
      />
    </header>
  )
}

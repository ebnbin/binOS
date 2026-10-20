import { useEffect, useRef, useState } from 'react'
import { useApps } from '../apps/index.ts'
import styles from './SplitPicker.module.css'

export function SplitPicker({ app, portrait, onChoose, onCancel }: {
  app: string
  portrait: boolean
  onChoose: (app: string, side: number) => void
  onCancel: () => void
}) {
  const apps = useApps()
  const [side, setSide] = useState<number | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const element = dialog.current!
    element.showModal()
    return () => element.close()
  }, [])

  return (
    <dialog ref={dialog} className={styles.picker} aria-label="选择分屏" onCancel={onCancel}>
      <p>{side === null ? (portrait ? '选择当前 app 的位置 · 上下均分' : '选择当前 app 的位置 · 左右均分') : '选择第二个 app'}</p>
      <div className={styles.choices}>
        {side === null ? [0, 1].map((position) => (
          <button key={position} type="button" onClick={() => setSide(position)}>
            {portrait ? (position === 0 ? '上边' : '下边') : (position === 0 ? '左边' : '右边')}
          </button>
        )) : apps.filter((item) => item.id !== app).map((item) => (
          <button key={item.id} type="button" onClick={() => onChoose(item.id, side)}>
            <item.icon size={20} />{item.name}
          </button>
        ))}
      </div>
      <div className={styles.actions}>
        {side !== null && <button type="button" onClick={() => setSide(null)}>返回</button>}
        <button type="button" onClick={onCancel}>取消</button>
      </div>
    </dialog>
  )
}

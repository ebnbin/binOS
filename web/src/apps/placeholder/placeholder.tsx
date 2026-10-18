import type { LucideIcon } from 'lucide-react'
import { useEffect } from 'react'
import { useElementSize } from '../../ui/useElementSize.ts'
import type { AppContext, WidgetProps } from '../types.ts'
import styles from './placeholder.module.css'

type Info = { name: string; icon: LucideIcon }

// 没有内容，只显示自己拿到的尺寸
export function PlaceholderApp({ ctx, name, icon: Icon }: { ctx: AppContext } & Info) {
  const [ref, size] = useElementSize<HTMLDivElement>()
  const { setTitle } = ctx
  useEffect(() => setTitle(''), [setTitle])
  return (
    <div ref={ref} className={styles.app}>
      <Icon size={40} strokeWidth={1.5} />
      <span className={styles.name}>{name}</span>
      <span className={styles.size}>{size ? `${Math.round(size.width)} × ${Math.round(size.height)}` : ''}</span>
    </div>
  )
}

export function PlaceholderWidget({ size, name, icon: Icon }: WidgetProps & Info) {
  return (
    <div className={styles.widget}>
      <Icon size={22} strokeWidth={1.75} />
      <span className={styles.name}>{name}</span>
      <span className={styles.size}>{size.replace('x', ' × ')}</span>
    </div>
  )
}

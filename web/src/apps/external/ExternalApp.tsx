import { useEffect } from 'react'
import type { AppContext } from '../types.ts'
import styles from './ExternalApp.module.css'

// 不加 sandbox：这些都是自己的 app，sandbox 会挡住它们的 Service Worker 和新窗口。
// 它们在别的域名下，读不到 binOS 的页面和登录状态
export function ExternalApp({ ctx, name, url }: { ctx: AppContext; name: string; url: string }) {
  const { setTitle } = ctx
  useEffect(() => setTitle(''), [setTitle])
  return <iframe className={styles.frame} src={url} title={name} allow="clipboard-write" referrerPolicy="strict-origin-when-cross-origin" />
}

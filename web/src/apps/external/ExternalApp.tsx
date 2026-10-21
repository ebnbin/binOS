import { useEffect } from 'react'
import type { WindowContext } from '../types.ts'
import styles from './ExternalApp.module.css'

// 不加 sandbox：这些都是自己的 app，sandbox 会挡住它们的 Service Worker 和新窗口。
// 它们在别的域名下，读不到 binOS 的页面和登录状态。跨域 iframe 默认不能用的能力在 allow 里放开。
// 不发 Referer：嵌入的 app 不需要知道是被谁打开的
const allow = 'autoplay; clipboard-write; fullscreen; gamepad; microphone'

export function ExternalApp({ ctx, name, url }: { ctx: WindowContext; name: string; url: string }) {
  const { setTitle } = ctx
  useEffect(() => setTitle(''), [setTitle])
  return <iframe className={styles.frame} src={url} title={name} allow={allow} referrerPolicy="no-referrer" />
}

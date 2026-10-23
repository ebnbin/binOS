import { useEffect, useRef, useState } from 'react'
import { ProgressCircle } from '../../ui/ProgressCircle.tsx'
import styles from './HtmlFrame.module.css'

// 网页在 sandbox 里只开放脚本：来源是不透明的，碰不到 binOS 的登录状态、接口和外层页面。
// 后端只把 HTML 当下载提供，这里取回内容放进 srcdoc，不让它以 binOS 的来源运行
const sandbox = 'allow-scripts'

// 附在网页末尾，把内容高度告诉外层，外层据此调整框的高度。
// 不在屏幕上的跨源 iframe，Chrome 会暂停它的 ResizeObserver，所以加载完成时也报一次
const reportHeight = `<script>(() => {
  const post = () => parent.postMessage({ binosFrameHeight: document.documentElement.getBoundingClientRect().height }, '*')
  new ResizeObserver(post).observe(document.documentElement)
  addEventListener('load', post)
})()</script>`

const defaultHeight = 360
const maxHeight = 720

export function HtmlFrame({ url, title }: { url: string; title: string }) {
  const [html, setHtml] = useState<string>()
  const [failed, setFailed] = useState(false)
  const [height, setHeight] = useState(defaultHeight)
  const frame = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch(url, { signal: controller.signal, headers: { Range: 'bytes=0-1048576' } })
      .then((res) => {
        const size = Number(res.headers.get('Content-Range')?.split('/')[1] ?? res.headers.get('Content-Length'))
        return res.ok && size <= 1_048_576 ? res.text() : Promise.reject(new Error('无法内嵌预览'))
      })
      .then((text) => setHtml(text + reportHeight))
      .catch(() => controller.signal.aborted || setFailed(true))
    return () => controller.abort()
  }, [url])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const value = (event.data as { binosFrameHeight?: unknown } | null)?.binosFrameHeight
      if (event.source === frame.current?.contentWindow && typeof value === 'number' && value > 0) {
        setHeight(Math.min(Math.ceil(value), maxHeight))
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  return (
    <span className={styles.frame}>
      {failed ? (
        <span className={styles.status}>无法内嵌预览，请打开预览窗口或下载</span>
      ) : html === undefined ? (
        <span className={styles.status}>
          <ProgressCircle label="加载中" />
        </span>
      ) : (
        <iframe ref={frame} className={styles.content} style={{ height }} title={title} sandbox={sandbox} srcDoc={html} />
      )}
    </span>
  )
}

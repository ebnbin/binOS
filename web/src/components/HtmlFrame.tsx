import { Download, Globe, Maximize2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { fileUrl } from '../api.ts'
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

export function HtmlFrame({ sessionId, file, title }: { sessionId: number; file: string; title: string }) {
  const [html, setHtml] = useState<string>()
  const [failed, setFailed] = useState(false)
  const [height, setHeight] = useState(defaultHeight)
  const frame = useRef<HTMLIFrameElement>(null)
  const container = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch(fileUrl(sessionId, file), { signal: controller.signal })
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error(res.statusText))))
      .then((text) => setHtml(text + reportHeight))
      .catch(() => controller.signal.aborted || setFailed(true))
    return () => controller.abort()
  }, [sessionId, file])

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
    <span ref={container} className={styles.frame}>
      <span className={styles.bar}>
        <Globe size={14} strokeWidth={1.75} />
        <span className={styles.title}>{title}</span>
        {document.fullscreenEnabled && (
          <button type="button" className={styles.action} title="全屏" onClick={() => void container.current?.requestFullscreen()}>
            <Maximize2 size={14} strokeWidth={1.75} />
          </button>
        )}
        <a className={styles.action} href={fileUrl(sessionId, file, `${title}.html`)} title="下载">
          <Download size={14} strokeWidth={1.75} />
        </a>
      </span>
      {failed ? (
        <span className={styles.status}>网页加载失败</span>
      ) : html === undefined ? (
        <span className={styles.status}>加载中…</span>
      ) : (
        <iframe ref={frame} className={styles.content} style={{ height }} title={title} sandbox={sandbox} srcDoc={html} />
      )}
    </span>
  )
}

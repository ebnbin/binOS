import { Button, Input } from '../../ui/Controls.tsx'
import { ArrowLeft, ArrowRight, ArrowUpRight, Globe, House, RotateCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { IconButton } from '../../ui/IconButton.tsx'
import type { WindowContext } from '../types.ts'
import { addressRoute, browserAddress, routeAddress } from './address.ts'
import styles from './BrowserApp.module.css'

// 顶层导航会替换整个 binOS，不能随嵌入网页一起放开。
const sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals'

export function BrowserApp({ ctx }: { ctx: WindowContext }) {
  const requested = routeAddress(ctx.route)
  const url = requested && new URL(requested).origin !== window.location.origin ? requested : ''
  const [address, setAddress] = useState(url)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [history, setHistory] = useState({ entries: [url], index: 0 })
  const { setTitle } = ctx

  const [previousUrl, setPreviousUrl] = useState(url)
  if (previousUrl !== url) {
    setPreviousUrl(url)
    setAddress(url)
    setError('')
    setHistory((previous) =>
      previous.entries[previous.index] === url
        ? previous
        : {
            entries: [...previous.entries.slice(0, previous.index + 1), url],
            index: previous.index + 1,
          },
    )
  }

  useEffect(() => setTitle(url ? new URL(url).host : ''), [url, setTitle])

  function visit(next: string) {
    if (next === url) setRevision((value) => value + 1)
    ctx.navigate(addressRoute(next), { replace: true })
    setAddress(next)
    setError('')
  }

  function move(offset: number) {
    const index = history.index + offset
    setHistory({ ...history, index })
    visit(history.entries[index]!)
  }

  return (
    <div className={styles.app}>
      <div className={styles.toolbar}>
        <div className={styles.navigation}>
          <IconButton icon={ArrowLeft} label="上一个输入的网址" disabled={history.index === 0} onClick={() => move(-1)} />
          <IconButton
            icon={ArrowRight}
            label="下一个输入的网址"
            disabled={history.index === history.entries.length - 1}
            onClick={() => move(1)}
          />
          <IconButton icon={RotateCw} label="重新打开输入的网址" disabled={!url} onClick={() => setRevision((value) => value + 1)} />
          <IconButton icon={House} label="浏览器首页" onClick={() => visit('')} />
        </div>
        <form
          className={styles.address}
          onSubmit={(event) => {
            event.preventDefault()
            try {
              const next = browserAddress(address)
              if (new URL(next).origin === window.location.origin) throw new Error('请在新标签页中打开 binOS 自身的网址')
              visit(next)
            } catch (reason) {
              setError(reason instanceof Error ? reason.message : '网址格式不正确')
            }
          }}
        >
          <Input
            aria-label="网址"
            placeholder="输入网址"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            onFocus={(event) => event.target.select()}
            type="text"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <Button type="submit">前往</Button>
        </form>
        {url && (
          <a
            className={styles.external}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="在新标签页打开输入的网址"
            title="在新标签页打开输入的网址"
          >
            <ArrowUpRight size={19} />
          </a>
        )}
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {url ? (
        <>
          <div className={styles.notice}>
            地址栏和前后退仅记录输入的网址，网页内跳转不会同步。若网站拒绝嵌入或无法登录，可在新标签页打开。
          </div>
          <iframe
            key={`${url}:${revision}`}
            className={styles.frame}
            src={url}
            title={`网页：${url}`}
            sandbox={sandbox}
            referrerPolicy="no-referrer"
            allow="fullscreen"
          />
        </>
      ) : (
        <div className={styles.home}>
          <Globe size={44} strokeWidth={1.25} />
          <h1>浏览器</h1>
          <p>在上方输入网址，直接在 binOS 中浏览网页。</p>
          <p>支持 HTTP 和 HTTPS，省略协议时使用 HTTPS。部分网站不允许嵌入，需要在新标签页打开。</p>
        </div>
      )}
    </div>
  )
}

const retryDelay = 1000
// 后端每 15 秒发一次 ping，这么久什么都没收到，说明连接已经断了却没有报错（比如手机切换网络、电脑睡眠后）
const silenceLimit = 45_000
// 回到前台时，超过一次 ping 的间隔没有收到数据，就不等 silenceLimit，立刻重连
const visibleSilenceLimit = 20_000

// 网络断开时浏览器自己重连；连接被拒绝（比如登录过期、后端重启时拿到 Cloudflare 的错误页）时浏览器不再重连，隔一会儿由这里重连。
// 连接或重连迟迟没有结果时也由这里重连。返回关闭连接的函数
export function connectEventSource(
  url: () => string,
  handlers: { onMessage: (data: string) => void; onOpen?: () => void; onConnectedChange?: (connected: boolean) => void },
): () => void {
  let source: EventSource | undefined
  let retry: number | undefined
  let watchdog: number | undefined
  let lastActivity = Date.now()
  const alive = () => {
    lastActivity = Date.now()
    window.clearTimeout(watchdog)
    watchdog = window.setTimeout(() => {
      handlers.onConnectedChange?.(false)
      connect()
    }, silenceLimit)
  }

  const connect = () => {
    window.clearTimeout(retry)
    source?.close()
    const current = new EventSource(url())
    source = current
    alive()
    current.onopen = () => {
      alive()
      handlers.onConnectedChange?.(true)
      handlers.onOpen?.()
    }
    current.onmessage = (message) => {
      alive()
      handlers.onMessage(message.data)
    }
    current.addEventListener('ping', alive)
    current.onerror = () => {
      handlers.onConnectedChange?.(false)
      if (current.readyState === EventSource.CLOSED) {
        window.clearTimeout(watchdog)
        retry = window.setTimeout(connect, retryDelay)
      }
    }
  }
  const onVisible = () => {
    if (
      document.visibilityState === 'visible' &&
      (source?.readyState === EventSource.CLOSED || Date.now() - lastActivity > visibleSilenceLimit)
    ) {
      connect()
    }
  }

  document.addEventListener('visibilitychange', onVisible)
  connect()
  return () => {
    document.removeEventListener('visibilitychange', onVisible)
    window.clearTimeout(retry)
    window.clearTimeout(watchdog)
    source?.close()
  }
}

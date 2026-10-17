import type { SSEStreamingApi } from 'hono/streaming'

// 连接建立时立刻发出：只写响应头不会真的发出去。retry 让浏览器断线后 1 秒就重连，上线时后端重启不会断开太久
export const connectedPreamble = 'retry: 1000\n\n'

// 定时发 ping：Cloudflare 会断开长时间没有数据的连接，页面也靠它发现已经断掉却没有报错的连接
export async function keepAlive(stream: SSEStreamingApi) {
  while (!stream.aborted) {
    await stream.sleep(15000)
    await stream.writeSSE({ event: 'ping', data: '' })
  }
}

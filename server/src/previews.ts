import { readFileSync } from 'node:fs'
import type { MiddlewareHandler } from 'hono'
import { except } from 'hono/combine'
import { proxy } from 'hono/proxy'
import { requireOwner } from './access.js'
import { isTestInstance, previewsDir } from './paths.js'
import { previewBranch, previewInfoPath } from './preview-info.js'
import type { PreviewInfo } from './preview-info.js'

function previewPort(branch: string): number | undefined {
  try {
    return (JSON.parse(readFileSync(previewInfoPath(previewsDir, branch), 'utf8')) as PreviewInfo).port
  } catch {
    return undefined
  }
}

const forward: MiddlewareHandler = async (c) => {
  const branch = previewBranch(c.req.url)!
  const port = previewPort(branch)
  if (!port) {
    return c.text(`没有 ${branch} 的预览`, 404)
  }
  const { pathname, search } = new URL(c.req.url)
  let res: Response
  try {
    res = await proxy(`http://127.0.0.1:${port}${pathname}${search}`, c.req.raw)
  } catch {
    return c.text(`${branch} 的预览没有在运行，在它的 worktree 里运行 pnpm preview 重新启动`, 502)
  }
  return res.body ? new Response(endQuietlyOnAbort(res.body, c.req.raw.signal), res) : res
}

// 页面关闭时转发也随之中止，上游的读取会报错；这是正常结束，不当作错误写进日志。
// 预览实例中途断开时仍然报错，页面这一端随之断开，实时推送才会重连
function endQuietlyOnAbort(body: ReadableStream<Uint8Array>, signal: AbortSignal) {
  const reader = body.getReader()
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read()
        if (done) {
          controller.close()
        } else {
          controller.enqueue(value)
        }
      } catch (err) {
        if (signal.aborted) {
          controller.close()
        } else {
          controller.error(err)
        }
      }
    },
    cancel: (reason) => reader.cancel(reason),
  })
}

// 子域名的请求先由正式版校验身份，再转给对应分支的预览实例；预览实例本身是测试实例，不再转发
export const previewProxy = except((c) => isTestInstance || !previewBranch(c.req.url), requireOwner, forward)

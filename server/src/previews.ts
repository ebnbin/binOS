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
  try {
    return await proxy(`http://127.0.0.1:${port}${pathname}${search}`, c.req.raw)
  } catch {
    return c.text(`${branch} 的预览没有在运行，在它的 worktree 里运行 pnpm preview 重新启动`, 502)
  }
}

// 子域名的请求先由正式版校验身份，再转给对应分支的预览实例；预览实例本身是测试实例，不再转发
export const previewProxy = except((c) => isTestInstance || !previewBranch(c.req.url), requireOwner, forward)
